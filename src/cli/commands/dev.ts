import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { watchSkill } from "../../builder/index.js";
import { applyWorkspaceLocale, t } from "../i18n.js";
import { formatBytes, log } from "../utils.js";

export interface DevOptions {
  cwd?: string;
  /**
   * 自定义产物根目录。常用于把 dev 产物直接吐到 agent 的 skills 目录，
   * 比如 `--out ~/.agent/skills`,重编后 agent 直接能跑。
   * 不传则落到 `<skillDir>/dist`。
   */
  out?: string;
  /** 是否生成 sourcemap，默认 inline，方便定位错误堆栈。 */
  sourcemap?: boolean;
  /**
   * 重编成功后自动运行 bundle，等价于 `node <bundle> <run-args>`。
   * 用于本地快速回归：保存即重编即运行。
   *
   * 示例：`skill-kits dev hello --run "--name=world"`
   * 设为空字符串时则不带任何参数运行：`--run ""`
   */
  run?: string;
}

/**
 * 开发模式：esbuild watch，源码或 SKILL.md 变更即重编。
 *
 * 默认 sourcemap=inline，便于堆栈定位。指定 `--out <dir>` 后，产物会输出到
 * `<dir>/<skill-name>/`，比如：
 *
 *     skill-kits dev daily-report --out ~/.agent/skills
 *     # → ~/.agent/skills/daily-report/{SKILL.md, scripts/main.mjs, ...}
 *
 * 配合 `--run` 可在每次重编后自动跑一次 bundle，便于本地回归。
 */
export async function runDev(
  name: string,
  options: DevOptions = {},
): Promise<void> {
  const cwd = resolve(options.cwd ?? process.cwd());
  applyWorkspaceLocale(cwd);
  const skillDir = join(cwd, "packages", "skills", name);
  if (!existsSync(skillDir)) {
    throw new Error(t("skill.notFound", { name, dir: skillDir }));
  }

  const outDir = options.out ? resolve(cwd, options.out) : undefined;
  const sourcemap: false | "inline" =
    options.sourcemap === false ? false : "inline";
  const shouldRun = typeof options.run === "string";

  log.info(t("dev.watching", { name: log.bold(name) }));
  if (outDir) {
    log.dim(t("dev.outDir", { path: relative(cwd, join(outDir, name)) || "." }));
  }
  if (shouldRun) {
    log.dim(t("dev.autoRun", { args: options.run }));
  }

  let child: ChildProcess | undefined;
  const killChild = (): Promise<void> =>
    new Promise((resolveKill) => {
      if (!child || child.exitCode !== null || child.signalCode !== null) {
        resolveKill();
        return;
      }
      child.once("exit", () => resolveKill());
      try {
        child.kill("SIGTERM");
      } catch {
        resolveKill();
      }
      // 兜底：3s 仍未退出则发 SIGKILL。
      setTimeout(() => {
        if (child && child.exitCode === null && child.signalCode === null) {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
        }
      }, 3_000).unref();
    });

  const dispose = await watchSkill(
    { skillDir, outDir, sourcemap },
    (result, error) => {
      if (error) {
        log.error(t("dev.rebuildFailed", { message: error.message }));
        return;
      }
      if (!result) return;
      if (result.kind === "bundle") {
        log.success(
          t("dev.rebuilt", {
            path: relative(cwd, result.bundleFile),
            size: formatBytes(result.bundleBytes),
          }),
        );
      } else {
        // 仅 SKILL.md / references / assets 同步，未触发 esbuild 重编。
        log.success(t("dev.synced", { path: relative(cwd, result.skillOutDir) }));
      }
      if (!shouldRun) return;
      // 仅在真正重编 JS 后才重启子进程；纯资源同步不重启，避免无意义打断。
      if (result.kind !== "bundle") return;
      // 先杀掉上一次的进程，避免端口/资源叠加；再启动新进程。
      void killChild().then(() => {
        const args = (options.run ?? "").trim();
        const cmd = `node ${JSON.stringify(result.bundleFile)}${args ? ` ${args}` : ""}`;
        log.dim(`  > ${cmd}`);
        child = spawn(cmd, {
          shell: true,
          stdio: "inherit",
        });
        child.on("exit", (code, signal) => {
          if (code !== null && code !== 0) {
            log.dim(t("dev.childExit", { code }));
          } else if (signal) {
            log.dim(t("dev.childSignal", { signal }));
          }
        });
      });
    },
  );

  process.on("SIGINT", async () => {
    await killChild();
    await dispose();
    log.info(t("dev.exited"));
    process.exit(0);
  });
}
