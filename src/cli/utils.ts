import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export { isValidSkillName } from "../core/index.js";

/** Supported UI locales. Kept intentionally small for a lightweight scaffold. */
export type Locale = "en" | "zh-CN";

/**
 * Resolve the active locale.
 * Priority: explicit value (e.g. `--locale`) > `SKILL_KITS_LOCALE` > `LC_ALL` > `LANG`.
 * Anything starting with `zh` maps to `zh-CN`; everything else falls back to `en`.
 */
export function resolveLocale(explicit?: string): Locale {
  const raw =
    explicit ??
    process.env.SKILL_KITS_LOCALE ??
    process.env.LC_ALL ??
    process.env.LANG ??
    "";
  return raw.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

/** 读取 workspace 根 `.skillkitrc.json` 里记录的 locale（init 时写入）。 */
export function readWorkspaceLocale(cwd: string): string | undefined {
  const file = join(cwd, ".skillkitrc.json");
  if (!existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return typeof parsed?.locale === "string" ? parsed.locale : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 定位脚手架附带的 `templates/` 目录：
 * 不论 CLI 来自 dist/（已发布）还是 src/（dev 模式 via tsx），
 * templates 都位于包根目录。
 */
export function templatesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli/utils.js → ../../templates
  // src/cli/utils.ts  → ../../templates
  return resolve(here, "..", "..", "templates");
}

/** ANSI helpers — 不依赖 chalk，保持包体积小。 */
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
} as const;

const useColor =
  process.stdout.isTTY &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb";

function paint(code: string, msg: string): string {
  return useColor ? `${code}${msg}${ANSI.reset}` : msg;
}

export const log = {
  info: (msg: string) => console.log(`${paint(ANSI.cyan, "›")} ${msg}`),
  success: (msg: string) => console.log(`${paint(ANSI.green, "✔")} ${msg}`),
  warn: (msg: string) => console.warn(`${paint(ANSI.yellow, "!")} ${msg}`),
  error: (msg: string) => console.error(`${paint(ANSI.red, "✖")} ${msg}`),
  dim: (msg: string) => console.log(paint(ANSI.dim, msg)),
  bold: (msg: string) => paint(ANSI.bold, msg),
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
