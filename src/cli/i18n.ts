import type { Locale } from "./utils.js";
import { readWorkspaceLocale, resolveLocale } from "./utils.js";

/**
 * Lightweight CLI i18n. No external dependency, no async loading.
 * Each message is a string or a function of named params; the two locales
 * share identical keys so missing translations surface at type-check time.
 */
type Msg = string | ((p: Record<string, unknown>) => string);

let current: Locale = resolveLocale();

/** Override the active locale (e.g. from a `--locale` flag). */
export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/**
 * Resolve and apply the active locale for commands that run inside a workspace
 * (build / dev / lint / pack / test). Priority: explicit flag > workspace
 * `.skillkitrc.json` > env detection. Returns the resolved locale.
 */
export function applyWorkspaceLocale(cwd: string, explicit?: string): Locale {
  const locale = resolveLocale(explicit ?? readWorkspaceLocale(cwd));
  setLocale(locale);
  return locale;
}

const en = {
  // init
  "init.confirm": (p) => `Initialize a Skill workspace in (${p.dest})? Continue?`,
  "init.cancelled": "Initialization cancelled.",
  "init.dirNotEmpty": (p) => `Target directory is not empty: ${p.dest}`,
  "init.start": (p) => `Initializing ${p.name} → ${p.dest}`,
  "init.done": "Project initialized.",
  "init.nextSteps": "Next steps:",
  // new
  "new.workspaceMissing": (p) =>
    `pnpm-workspace.yaml not found in ${p.cwd}. Run \`npx skill-kits init\` first, or pass --cwd to point at the workspace root.`,
  "new.dirExists": (p) => `Skill directory already exists: ${p.dir}`,
  "new.start": (p) => `Creating Skill ${p.name} → ${p.dir}`,
  "new.done": (p) => `Skill ${p.name} created.`,
  "new.nextSteps": "Next steps:",
  "new.step1": (p) =>
    `  1. Edit ${p.path} to refine description / trigger conditions / command list`,
  "new.step2": (p) =>
    `  2. Put long docs in ${p.path}, and templates/resources in assets/ [optional]`,
  // shared
  "skill.invalidName": (p) =>
    `Invalid Skill name: ${p.name}. Must be kebab-case (a-z, 0-9, -), not start/end with - or contain --.`,
  "skill.notFound": (p) => `Skill not found: ${p.name} (looked in ${p.dir})`,
  "skill.notFoundShort": (p) => `Skill not found: ${p.name}`,
  // build
  "build.noSkills":
    "No buildable Skill in this workspace. Run `npx skill-kits new <name>` first.",
  "build.lintFailed": (p) =>
    `${p.name} lint failed: ${p.count} error(s) (add --no-lint to skip)`,
  "build.start": (p) => `Building ${p.name} ...`,
  "build.done": (p) => `${p.name} built (${p.elapsed}s)`,
  "build.fieldSkillDir": "Skill dir   ",
  "build.fieldBundle": "Entry JS    ",
  "build.fieldSkillMd": "SKILL.md    ",
  "build.fieldHelp": "help cmd    ",
  "build.fieldZip": "zip output  ",
  // dev
  "dev.watching": (p) => `Watching source changes for ${p.name} ...`,
  "dev.outDir": (p) => `  Output to: ${p.path}`,
  "dev.autoRun": (p) => `  Auto-run after rebuild: node <bundle> ${p.args}`,
  "dev.rebuildFailed": (p) => `Rebuild failed: ${p.message}`,
  "dev.rebuilt": (p) => `Rebuilt: ${p.path} (${p.size})`,
  "dev.synced": (p) => `Synced: ${p.path} (SKILL.md / references / assets)`,
  "dev.childExit": (p) => `  (child exited code=${p.code})`,
  "dev.childSignal": (p) => `  (child terminated by signal: ${p.signal})`,
  "dev.exited": "Exited.",
  // lint
  "lint.noSkills": "No Skill to lint in this workspace.",
  "lint.checking": (p) => `Linting ${p.name}`,
  "lint.stats": (p) =>
    `  stats: body ${p.lines} lines / ${p.chars} chars; description ${p.descChars} chars`,
  "lint.workspace": (p) => `workspace: ${p.path}`,
  "lint.failed": (p) => `Lint failed: ${p.errors} error(s), ${p.warns} warning(s)`,
  "lint.strictFailed": (p) => `Strict mode failed: ${p.warns} warning(s)`,
  "lint.passed": (p) => `Lint passed (${p.warns} warning(s))`,
  // pack
  "pack.stale": (p) =>
    `dist output is older than source SKILL.md (${p.distTime} < ${p.srcTime}); consider running \`skill-kits build ${p.name}\` first`,
  "pack.done": (p) => `${p.name} packed: ${p.path} (${p.size}, ${p.entries} entries)`,
  // test
  "test.noSkills":
    "No testable Skill in this workspace. Run `npx skill-kits new <name>` first.",
  "test.tsxMissing":
    "tsx not found. Install it at the workspace root: `pnpm add -Dw tsx` (used to run TS tests directly).",
  "test.noFiles":
    "No test files found (convention: packages/skills/<name>/src/**/*.test.ts).",
  "test.running": (p) => `Running tests: ${p.targets} (${p.count} file(s))`,
  "test.failed": (p) => `Tests failed (exit ${p.code})`,
  "test.passed": "Tests passed",
} satisfies Record<string, Msg>;

type Key = keyof typeof en;

const zhCN: Record<Key, Msg> = {
  "init.confirm": (p) => `将在目录 (${p.dest}) 初始化 Skill 工作区，是否继续？`,
  "init.cancelled": "已取消初始化。",
  "init.dirNotEmpty": (p) => `目标目录非空: ${p.dest}`,
  "init.start": (p) => `正在初始化 ${p.name} → ${p.dest}`,
  "init.done": "项目初始化完成。",
  "init.nextSteps": "后续步骤：",
  "new.workspaceMissing": (p) =>
    `未在 ${p.cwd} 找到 pnpm-workspace.yaml。请先执行 \`npx skill-kits init\`，或通过 --cwd 指定 workspace 根目录。`,
  "new.dirExists": (p) => `Skill 目录已存在：${p.dir}`,
  "new.start": (p) => `正在创建 Skill ${p.name} → ${p.dir}`,
  "new.done": (p) => `Skill ${p.name} 创建完成。`,
  "new.nextSteps": "后续步骤：",
  "new.step1": (p) =>
    `  1. 编辑 ${p.path} 完善 description / 触发条件 / 命令清单`,
  "new.step2": (p) =>
    `  2. 在 ${p.path} 放长文档，在 assets/ 放模板/资源【可选】`,
  "skill.invalidName": (p) =>
    `名称非法：${p.name}。需符合 kebab-case（a-z, 0-9, -），且不能以 - 开头/结尾或出现 --。`,
  "skill.notFound": (p) => `Skill 不存在: ${p.name}（已查找 ${p.dir}）`,
  "skill.notFoundShort": (p) => `Skill 不存在: ${p.name}`,
  "build.noSkills":
    "当前 workspace 下没有可构建的 Skill。先执行 `npx skill-kits new <name>`。",
  "build.lintFailed": (p) =>
    `${p.name} lint 失败：${p.count} 个错误（可加 --no-lint 跳过校验）`,
  "build.start": (p) => `正在构建 ${p.name} ...`,
  "build.done": (p) => `${p.name} 构建完成（${p.elapsed}s）`,
  "build.fieldSkillDir": "Skill 包目录 ",
  "build.fieldBundle": "入口 JS     ",
  "build.fieldSkillMd": "SKILL.md    ",
  "build.fieldHelp": "help 命令    ",
  "build.fieldZip": "zip 产物    ",
  "dev.watching": (p) => `正在监听 ${p.name} 的源码变化 ...`,
  "dev.outDir": (p) => `  产物输出至：${p.path}`,
  "dev.autoRun": (p) => `  重编后自动运行：node <bundle> ${p.args}`,
  "dev.rebuildFailed": (p) => `重编失败: ${p.message}`,
  "dev.rebuilt": (p) => `已重编：${p.path}（${p.size}）`,
  "dev.synced": (p) => `已同步：${p.path}（SKILL.md / references / assets）`,
  "dev.childExit": (p) => `  (子进程退出 code=${p.code})`,
  "dev.childSignal": (p) => `  (子进程被信号终止: ${p.signal})`,
  "dev.exited": "已退出。",
  "lint.noSkills": "当前 workspace 下没有可校验的 Skill。",
  "lint.checking": (p) => `正在校验 ${p.name}`,
  "lint.stats": (p) =>
    `  统计：body ${p.lines} 行 / ${p.chars} 字符；description ${p.descChars} 字符`,
  "lint.workspace": (p) => `workspace: ${p.path}`,
  "lint.failed": (p) => `校验失败：${p.errors} 个错误，${p.warns} 个警告`,
  "lint.strictFailed": (p) => `严格模式失败：${p.warns} 个警告`,
  "lint.passed": (p) => `校验通过（${p.warns} 个警告）`,
  "pack.stale": (p) =>
    `dist 产物比源 SKILL.md 旧（${p.distTime} < ${p.srcTime}），建议先 \`skill-kits build ${p.name}\``,
  "pack.done": (p) =>
    `${p.name} 已打包：${p.path}（${p.size}, ${p.entries} entries）`,
  "test.noSkills":
    "当前 workspace 下没有可测试的 Skill。先执行 `npx skill-kits new <name>`。",
  "test.tsxMissing":
    "未找到 tsx，请在 workspace 根目录安装：`pnpm add -Dw tsx`（用于直跑 TS 测试）。",
  "test.noFiles": "未发现测试文件（约定：packages/skills/<name>/src/**/*.test.ts）。",
  "test.running": (p) => `运行测试：${p.targets}（${p.count} 个文件）`,
  "test.failed": (p) => `测试失败（exit ${p.code}）`,
  "test.passed": "测试通过",
};

const catalogs: Record<Locale, Record<Key, Msg>> = { en, "zh-CN": zhCN };

/** Translate a key with optional named params for the active locale. */
export function t(key: Key, params: Record<string, unknown> = {}): string {
  const msg = catalogs[current][key];
  return typeof msg === "function" ? msg(params) : msg;
}
