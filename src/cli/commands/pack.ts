import { existsSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { packSkill } from "../../builder/pack.js";
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
  const skillDir = join(cwd, "packages", "skills", name);
  if (!existsSync(skillDir)) {
    throw new Error(`Skill 不存在: ${name}（已查找 ${skillDir}）`);
  }

  // 新鲜度检查：源 SKILL.md mtime > dist SKILL.md mtime → 提示重 build
  const srcMd = join(skillDir, "SKILL.md");
  const distMd = join(skillDir, "dist", name, "SKILL.md");
  if (existsSync(srcMd) && existsSync(distMd)) {
    const srcMtime = statSync(srcMd).mtimeMs;
    const distMtime = statSync(distMd).mtimeMs;
    if (srcMtime > distMtime + 1_000) {
      log.warn(
        `dist 产物比源 SKILL.md 旧（${new Date(distMtime).toISOString()} < ${new Date(srcMtime).toISOString()}），建议先 \`skill-kits build ${name}\``,
      );
    }
  }

  const result = await packSkill({ skillDir });
  log.success(
    `${name} 已打包：${relative(cwd, result.outFile)}（${formatBytes(result.bytes)}, ${result.entries} entries）`,
  );
}
