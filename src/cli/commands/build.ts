import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { buildSkill } from "../../builder/index.js";
import { lintSkill } from "../../builder/lint.js";
import { packSkill } from "../../builder/pack.js";
import { formatBytes, log } from "../utils.js";

export interface BuildCmdOptions {
  cwd?: string;
  minify?: boolean;
  /** 是否在构建前自动跑 lint，默认 true。可通过 `--no-lint` 关闭。 */
  lint?: boolean;
  /** 是否在构建后自动打包成 zip，默认 true。可通过 `--no-pack` 关闭。 */
  pack?: boolean;
}

async function listSkills(workspaceCwd: string): Promise<string[]> {
  const root = join(workspaceCwd, "packages", "skills");
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function runBuild(
  name: string | undefined,
  options: BuildCmdOptions = {},
): Promise<void> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const targets = name ? [name] : await listSkills(cwd);
  if (targets.length === 0) {
    throw new Error(
      "当前 workspace 下没有可构建的 Skill。先执行 `npx skill-kits new <name>`。",
    );
  }

  for (const target of targets) {
    const skillDir = join(cwd, "packages", "skills", target);
    if (!existsSync(skillDir)) {
      log.error(`Skill 不存在: ${target}（已查找 ${skillDir}）`);
      process.exitCode = 1;
      continue;
    }

    // 默认先跑一遍 lint：成本极低（纯字符串解析），能在产物落盘前拦住 SKILL.md 的格式问题。
    // 任何 error 级问题直接中断当前 Skill 构建；warn 仅打印不阻塞。可通过 `--no-lint` 跳过。
    if (options.lint !== false) {
      const report = await lintSkill(skillDir);
      const errors = report.items.filter((i) => i.level === "error");
      const warns = report.items.filter((i) => i.level === "warn");
      for (const item of errors) {
        log.error(`  [lint:${item.rule}] ${item.message}`);
      }
      for (const item of warns) {
        log.warn(`  [lint:${item.rule}] ${item.message}`);
      }
      if (errors.length > 0) {
        log.error(
          `${target} lint 失败：${errors.length} 个错误（可加 --no-lint 跳过校验）`,
        );
        process.exitCode = 1;
        continue;
      }
    }

    log.info(`正在构建 ${log.bold(target)} ...`);
    const start = Date.now();
    const result = await buildSkill({
      skillDir,
      minify: options.minify,
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    log.success(`${target} 构建完成（${elapsed}s）`);
    log.dim(`  Skill 包目录 : ${relative(cwd, result.skillOutDir) || "."}`);
    log.dim(
      `  入口 JS     : ${relative(cwd, result.bundleFile)}（${formatBytes(result.bundleBytes)}）`,
    );
    log.dim(`  SKILL.md    : ${relative(cwd, result.skillMdFile)}`);
    log.dim(`  help 命令    : node ${relative(cwd, result.bundleFile)} --help`);

    // 默认顺手 pack 成 zip，省一道命令；可通过 `--no-pack` 关掉。
    if (options.pack !== false) {
      const packResult = await packSkill({
        skillDir,
        rootName: result.name,
      });
      log.dim(
        `  zip 产物    : ${relative(cwd, packResult.outFile)}（${formatBytes(packResult.bytes)}, ${packResult.entries} entries）`,
      );
    }
  }
}
