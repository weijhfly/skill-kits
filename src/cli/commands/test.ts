import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { applyWorkspaceLocale, t } from "../i18n.js";
import { log } from "../utils.js";

export interface TestCmdOptions {
  cwd?: string;
  /** 监听模式，文件变化自动重跑。 */
  watch?: boolean;
}

async function listSkills(workspaceCwd: string): Promise<string[]> {
  const root = join(workspaceCwd, "packages", "skills");
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/** 递归收集目录下所有 `*.test.ts` 文件（绝对路径）。 */
async function collectTestFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectTestFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * 定位 tsx 的入口。tsx 由 workspace 作为 devDependency 安装，
 * 从 workspace 根目录解析，避免依赖 skill-kits 自身的 node_modules。
 */
function resolveTsx(workspaceCwd: string): string | null {
  try {
    const require = createRequire(join(workspaceCwd, "package.json"));
    return require.resolve("tsx");
  } catch {
    return null;
  }
}

/**
 * 用 node 原生 test runner（`node --test`）+ tsx loader 直跑 TS 测试。
 * 测试文件约定：`packages/skills/<name>/src/**\/*.test.ts`。
 *
 * 选型理由：与脚手架「产物零依赖、node 直跑」理念一致，测试器保持轻；
 * tsx 仅作为 devDependency，不进 Skill 产物。
 */
export async function runTest(
  name: string | undefined,
  options: TestCmdOptions = {},
): Promise<void> {
  const cwd = resolve(options.cwd ?? process.cwd());
  applyWorkspaceLocale(cwd);
  const targets = name ? [name] : await listSkills(cwd);
  if (targets.length === 0) {
    throw new Error(t("test.noSkills"));
  }

  const tsxEntry = resolveTsx(cwd);
  if (!tsxEntry) {
    throw new Error(t("test.tsxMissing"));
  }

  const testFiles: string[] = [];
  for (const target of targets) {
    const skillDir = join(cwd, "packages", "skills", target);
    if (!existsSync(skillDir)) {
      log.error(t("skill.notFound", { name: target, dir: skillDir }));
      process.exitCode = 1;
      continue;
    }
    testFiles.push(...(await collectTestFiles(join(skillDir, "src"))));
  }

  if (testFiles.length === 0) {
    log.warn(t("test.noFiles"));
    return;
  }

  // node --import tsx --test <files...>：tsx 把 .ts 即时编译，node:test 发现并执行。
  const args = [
    "--import",
    tsxEntry,
    "--test",
    ...(options.watch ? ["--watch"] : []),
    ...testFiles,
  ];

  log.info(t("test.running", { targets: targets.join(", "), count: testFiles.length }));

  await new Promise<void>((resolvePromise) => {
    const child = spawn(process.execPath, args, { cwd, stdio: "inherit" });
    child.on("close", (code) => {
      if (code && code !== 0) {
        process.exitCode = code;
        log.error(t("test.failed", { code }));
      } else {
        log.success(t("test.passed"));
      }
      resolvePromise();
    });
  });
}
