/**
 * 打包 dist/<name>/ 为 dist/<name>.zip。
 */

import AdmZip from "adm-zip";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseSkillMd } from "./skill-md.js";

export interface PackOptions {
  /** Skill 源码目录。 */
  skillDir: string;
  /** 产物根目录，默认 `<skillDir>/dist`。 */
  outDir?: string;
  /** 输出 zip 路径，默认 `<outDir>/<name>.zip`。 */
  outFile?: string;
  /** 包内根目录名，默认取 SKILL.md 的 name 字段。 */
  rootName?: string;
}

export interface PackResult {
  outFile: string;
  bytes: number;
  entries: number;
}

export async function packSkill(options: PackOptions): Promise<PackResult> {
  const skillDir = resolve(options.skillDir);
  const outDir = resolve(options.outDir ?? join(skillDir, "dist"));

  // 优先从 SKILL.md 读 name，保证 zip 根目录 / 内部目录名一致
  const meta = await parseSkillMd(join(skillDir, "SKILL.md"));
  const rootName = options.rootName ?? meta.name;
  const skillOutDir = join(outDir, rootName);
  if (!existsSync(skillOutDir)) {
    throw new Error(
      `未找到产物目录，请先执行 \`skill-kits build\`：${skillOutDir}`,
    );
  }

  const outFile = resolve(options.outFile ?? join(outDir, `${rootName}.zip`));
  await mkdir(dirname(outFile), { recursive: true });

  const zip = new AdmZip();
  // adm-zip 的 addLocalFolder 会把文件加到 root，需要用 zipPath 指定子目录
  zip.addLocalFolder(skillOutDir, rootName);
  zip.writeZip(outFile);

  const s = await stat(outFile);
  const entries = zip.getEntries().length;
  return { outFile, bytes: s.size, entries };
}
