import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * 递归把 `srcDir` 拷贝到 `destDir`，对文本文件做 `{{var}}` 占位符替换；
 * 二进制文件原样拷贝。
 */
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yaml",
  ".yml",
  ".txt",
  ".html",
  ".css",
]);

export interface RenderTemplateOptions {
  vars?: Record<string, string>;
  /**
   * 文件名/目录名映射。常用于把仓库内不能直接放置的文件还原（例如
   * `_gitignore` -> `.gitignore`）。
   */
  rename?: Record<string, string>;
  /**
   * 目标 locale。模板里以 `<name>.<locale>.<ext>` 命名的文件视为本地化覆盖：
   * - locale 命中时，用该文件内容覆盖同名的基础文件（`<name>.<ext>`），并丢弃 locale 后缀；
   * - 未命中的 locale 变体一律跳过。
   * 例如 locale="zh-CN" 时，`SKILL.zh-CN.md` 覆盖 `SKILL.md`，而 `SKILL.en.md`（若有）被跳过。
   * 不传则忽略所有带 locale 后缀的文件，仅输出基础文件。
   */
  locale?: string;
}

function substitute(content: string, vars: Record<string, string>): string {
  return content.replace(
    /\{\s*\{\s*([a-zA-Z0-9_]+)\s*\}\s*\}/g,
    (_, key) => vars[key] ?? "",
  );
}

function isTextFile(path: string): boolean {
  const dot = path.lastIndexOf(".");
  return dot >= 0 && TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/** Locale suffixes the templates may carry. Keep in sync with the CLI Locale type. */
const KNOWN_LOCALES = ["en", "zh-CN"] as const;

/**
 * Detect a `<base>.<locale>.<ext>` filename.
 * Returns the locale and the de-localized base name, or null when not a variant.
 */
function parseLocaleVariant(
  name: string,
): { locale: string; baseName: string } | null {
  for (const locale of KNOWN_LOCALES) {
    const marker = `.${locale}.`;
    const idx = name.lastIndexOf(marker);
    if (idx > 0) {
      return { locale, baseName: name.slice(0, idx) + name.slice(idx + locale.length + 1) };
    }
  }
  return null;
}

export async function renderTemplate(
  srcDir: string,
  destDir: string,
  options: RenderTemplateOptions = {},
): Promise<void> {
  const vars = options.vars ?? {};
  const rename = options.rename ?? {};
  const locale = options.locale;

  async function walk(src: string, dest: string): Promise<void> {
    const entries = await readdir(src);
    await mkdir(dest, { recursive: true });

    // Base names that have a matching-locale override in this directory.
    // Their base files are skipped so the localized variant takes over.
    const overridden = new Set<string>();
    for (const entry of entries) {
      const variant = parseLocaleVariant(entry);
      if (variant && variant.locale === locale) {
        overridden.add(variant.baseName);
      }
    }

    for (const entry of entries) {
      const srcPath = join(src, entry);
      const s = await stat(srcPath);
      if (s.isDirectory()) {
        await walk(srcPath, join(dest, rename[entry] ?? entry));
        continue;
      }

      // Resolve the effective output filename, honoring locale variants.
      const variant = parseLocaleVariant(entry);
      let outName = entry;
      if (variant) {
        if (variant.locale !== locale) continue; // drop non-target variants
        outName = variant.baseName; // localized override → write under base name
      } else if (overridden.has(entry)) {
        continue; // a localized override exists; skip the base file
      }
      const destPath = join(dest, rename[outName] ?? outName);

      if (isTextFile(srcPath)) {
        const raw = await readFile(srcPath, "utf8");
        await mkdir(dirname(destPath), { recursive: true });
        await writeFile(destPath, substitute(raw, vars), "utf8");
      } else {
        const raw = await readFile(srcPath);
        await mkdir(dirname(destPath), { recursive: true });
        await writeFile(destPath, raw);
      }
    }
  }

  await walk(srcDir, destDir);
}
