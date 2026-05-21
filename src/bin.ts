#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runBuild } from "./cli/commands/build.js";
import { runDev } from "./cli/commands/dev.js";
import { runInit } from "./cli/commands/init.js";
import { runLint } from "./cli/commands/lint.js";
import { runNew } from "./cli/commands/new.js";
import { runPack } from "./cli/commands/pack.js";
import { log } from "./cli/utils.js";

// 运行时 Node 版本检查：与 package.json engines 字段保持一致。
// esbuild bundle 后的产物默认 ESM + top-level await，依赖 Node 18+。
const nodeMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "0",
  10,
);
if (Number.isFinite(nodeMajor) && nodeMajor < 18) {
  process.stderr.write(
    `skill-kits 需要 Node.js >= 18，当前为 ${process.versions.node}\n`,
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// 根据当前文件位置 (src/bin.ts 或 dist/bin.js) 向上寻找 package.json
const pkgPath = join(
  __dirname,
  __dirname.endsWith("dist") ? ".." : "..",
  "package.json",
);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const program = new Command()
  .name(pkg.name)
  .description(
    "Agent Skill 脚手架与编译工具链（init / new / build / dev / lint / pack）",
  )
  .version(pkg.version);

program
  .command("init [dir]")
  .description("初始化一个新的 Skill 工作区（缺省为当前目录）")
  .option("-n, --name <name>", "项目名称（缺省取目标目录名）")
  .action(async (dir: string | undefined, opts) => {
    try {
      await runInit(dir ?? ".", opts);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("new <name>")
  .description("在 workspace 中创建新 Skill（输出到 packages/skills/<name>）")
  .option("--cwd <dir>", "workspace 根目录（默认当前目录）")
  .action(async (name: string, opts) => {
    try {
      await runNew(name, opts);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("build [name]")
  .description(
    "编译 Skill（缺省名称则编译全部），产物为 dist/<name>/{SKILL.md, scripts/main.mjs, references/, assets/}，默认顺手 lint + pack 成 dist/<name>.zip",
  )
  .option("--minify", "压缩产物 JS")
  .option("--no-lint", "构建前不自动跑 lint")
  .option("--no-pack", "构建后不自动打包成 zip")
  .option("--cwd <dir>", "workspace 根目录（默认当前目录）")
  .action(async (name: string | undefined, opts) => {
    try {
      await runBuild(name, opts);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("dev <name>")
  .description(
    "监听源码变化，自动重新编译（默认 sourcemap=inline，方便定位错误堆栈）",
  )
  .option(
    "--out <dir>",
    "自定义产物根目录，重编后产物会落到 <dir>/<name>/。常用于直接吐到 agent skills 目录，便于联调",
  )
  .option("--no-sourcemap", "关闭 sourcemap")
  .option(
    "--run [args]",
    "重编成功后自动 `node <bundle> <args>` 跑一次，用于本地快速回归",
  )
  .option("--cwd <dir>", "workspace 根目录（默认当前目录）")
  .action(async (name: string, opts) => {
    try {
      // commander 把无值的 --run 解析为 true，需要规范成空字符串。
      const run =
        opts.run === true
          ? ""
          : typeof opts.run === "string"
            ? opts.run
            : undefined;
      await runDev(name, { ...opts, run });
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("lint [name]")
  .description("校验 SKILL.md（name/dir 一致、行数、引用、description 触发性）")
  .option("--strict", "把 warn 视作 error")
  .option("--cwd <dir>", "workspace 根目录（默认当前目录）")
  .action(async (name: string | undefined, opts) => {
    try {
      await runLint(name, opts);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("pack <name>")
  .description("把 dist/<name>/ 打包成 dist/<name>.zip（要求先执行 build）")
  .option("--cwd <dir>", "workspace 根目录（默认当前目录）")
  .action(async (name: string, opts) => {
    try {
      await runPack(name, opts);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program.parseAsync().catch((err) => {
  log.error(err.message ?? String(err));
  process.exit(1);
});
