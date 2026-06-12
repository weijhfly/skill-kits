import { existsSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { packSkill } from "../../builder/pack.js";
import { applyWorkspaceLocale, t } from "../i18n.js";
import { formatBytes, log } from "../utils.js";

export interface PackCmdOptions {
  cwd?: string;
}

/**
 * 打包 dist/<name>/ 为 dist/<name>.zip。
 *
 * 会做一次新鲜度检查：如果源 SKILL.md 比 dist 中的旧，则提示用户先 build。
 * 不阻塞，只是 warn —— 用户也许是在重新打包旧产物。
 */
export async function runPack(
  name: string,
  options: PackCmdOptions = {},
): Promise<void> {
  const cwd = resolve(options.cwd ?? process.cwd());
  applyWorkspaceLocale(cwd);
  const skillDir = join(cwd, "packages", "skills", name);
  if (!existsSync(skillDir)) {
    throw new Error(t("skill.notFound", { name, dir: skillDir }));
  }

  // 新鲜度检查：源 SKILL.md mtime > dist SKILL.md mtime → 提示重 build
  const srcMd = join(skillDir, "SKILL.md");
  const distMd = join(skillDir, "dist", name, "SKILL.md");
  if (existsSync(srcMd) && existsSync(distMd)) {
    const srcMtime = statSync(srcMd).mtimeMs;
    const distMtime = statSync(distMd).mtimeMs;
    if (srcMtime > distMtime + 1_000) {
      log.warn(
        t("pack.stale", {
          name,
          distTime: new Date(distMtime).toISOString(),
          srcTime: new Date(srcMtime).toISOString(),
        }),
      );
    }
  }

  const result = await packSkill({ skillDir });
  log.success(
    t("pack.done", {
      name,
      path: relative(cwd, result.outFile),
      size: formatBytes(result.bytes),
      entries: result.entries,
    }),
  );
}
