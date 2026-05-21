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

export async function renderTemplate(
  srcDir: string,
  destDir: string,
  options: RenderTemplateOptions = {},
): Promise<void> {
  const vars = options.vars ?? {};
  const rename = options.rename ?? {};

  async function walk(src: string, dest: string): Promise<void> {
    const entries = await readdir(src);
    await mkdir(dest, { recursive: true });
    for (const entry of entries) {
      const srcPath = join(src, entry);
      const finalName = rename[entry] ?? entry;
      const destPath = join(dest, finalName);
      const s = await stat(srcPath);
      if (s.isDirectory()) {
        await walk(srcPath, destPath);
      } else if (isTextFile(srcPath)) {
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
