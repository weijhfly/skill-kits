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
import { runTest } from "./cli/commands/test.js";
import { log } from "./cli/utils.js";

// 运行时 Node 版本检查：与 package.json engines 字段保持一致。
// esbuild bundle 后的产物默认 ESM + top-level await，依赖 Node 18+。
const nodeMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "0",
  10,
);
if (Number.isFinite(nodeMajor) && nodeMajor < 18) {
  process.stderr.write(
    `skill-kits requires Node.js >= 18, current version is ${process.versions.node}\n`,
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
    "Scaffold and build toolchain for Agent Skills (init / new / build / dev / lint / pack)",
  )
  .version(pkg.version);

program
  .command("init [dir]")
  .description("Initialize a new Skill workspace (defaults to the current directory)")
  .option("-n, --name <name>", "Project name (defaults to the target directory name)")
  .option("--locale <locale>", "UI / template language: en | zh-CN (defaults to env detection)")
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
  .description("Create a new Skill in the workspace (output to packages/skills/<name>)")
  .option("--cwd <dir>", "Workspace root directory (defaults to the current directory)")
  .option("--locale <locale>", "Template language: en | zh-CN (defaults to the workspace config, then env)")
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
    "Build a Skill (builds all when name is omitted). Output: dist/<name>/{SKILL.md, scripts/main.mjs, references/, assets/}, with lint + pack into dist/<name>.zip by default",
  )
  .option("--minify", "Minify the output JS")
  .option("--no-lint", "Skip lint before building")
  .option("--no-pack", "Skip packing into a zip after building")
  .option("--cwd <dir>", "Workspace root directory (defaults to the current directory)")
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
    "Watch source changes and rebuild automatically (sourcemap=inline by default for easier stack traces)",
  )
  .option(
    "--out <dir>",
    "Custom output root; rebuilt artifacts go to <dir>/<name>/. Handy for syncing directly to an agent skills directory",
  )
  .option("--no-sourcemap", "Disable sourcemap")
  .option(
    "--run [args]",
    "Run `node <bundle> <args>` once after a successful rebuild, for quick local regression",
  )
  .option("--cwd <dir>", "Workspace root directory (defaults to the current directory)")
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
  .description("Lint SKILL.md (name/dir match, line count, references, description triggers)")
  .option("--strict", "Treat warnings as errors")
  .option("--cwd <dir>", "Workspace root directory (defaults to the current directory)")
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
  .description("Pack dist/<name>/ into dist/<name>.zip (requires running build first)")
  .option("--cwd <dir>", "Workspace root directory (defaults to the current directory)")
  .action(async (name: string, opts) => {
    try {
      await runPack(name, opts);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("test [name]")
  .description(
    "Run Skill unit tests (tests all when name is omitted). Convention: packages/skills/<name>/src/**/*.test.ts, based on node:test + tsx",
  )
  .option("--watch", "Watch files and rerun automatically")
  .option("--cwd <dir>", "Workspace root directory (defaults to the current directory)")
  .action(async (name: string | undefined, opts) => {
    try {
      await runTest(name, opts);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program.parseAsync().catch((err) => {
  log.error(err.message ?? String(err));
  process.exit(1);
});
