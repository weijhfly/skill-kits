import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { type SkillMeta, validateSkillMeta } from "../core/index.js";

export interface ParsedSkillMd extends SkillMeta {
  /** SKILL.md 中除 frontmatter 之外的正文。 */
  body: string;
}

/**
 * 解析 SKILL.md，提取 YAML frontmatter 与正文，并对 frontmatter 做轻量校验。
 *
 * 字段对齐 Agent Skills 官方规范：https://agentskills.io/specification
 *
 * 使用 `yaml` 包做完整 YAML 解析，支持：
 *   - 标量、对象、数组、嵌套结构
 *   - 块字符串（| / >）
 *   - 注释、引号
 */
export async function parseSkillMd(path: string): Promise<ParsedSkillMd> {
  const raw = await readFile(path, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`SKILL.md 缺少 YAML frontmatter: ${path}`);
  }

  let fm: Record<string, unknown>;
  try {
    const parsed = parseYaml(match[1] ?? "");
    if (parsed === null || parsed === undefined) {
      fm = {};
    } else if (typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("frontmatter 必须是 YAML 对象");
    } else {
      fm = parsed as Record<string, unknown>;
    }
  } catch (err) {
    throw new Error(
      `SKILL.md frontmatter YAML 解析失败 (${path}): ${(err as Error).message}`,
    );
  }

  const body = (match[2] ?? "").trimStart();

  const meta: Record<string, unknown> = {
    name: fm.name,
    description:
      typeof fm.description === "string"
        ? fm.description.trim()
        : fm.description,
    license: fm.license,
    compatibility: fm.compatibility,
    metadata: normalizeMetadata(fm.metadata),
    "allowed-tools": fm["allowed-tools"],
  };
  for (const k of Object.keys(meta)) {
    if (meta[k] === undefined) delete meta[k];
  }

  const errors = validateSkillMeta(meta);
  if (errors.length > 0) {
    throw new Error(
      `SKILL.md frontmatter 校验失败 (${path}):\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return { ...(meta as unknown as SkillMeta), body };
}

/**
 * metadata 规范：官方要求为字符串到字符串的映射。
 * 对数字/布尔值做兜底字符串化，尽可能减少校验摩擦。
 */
function normalizeMetadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    result[k] = typeof v === "string" ? v : String(v);
  }
  return result;
}
