/**
 * Skill 元信息。来源：SKILL.md 的 YAML frontmatter。
 *
 * 字段对齐 Agent Skills 官方规范：https://agentskills.io/specification
 * 仅描述与平台无关的通用元数据，业务平台特有字段请放进 `metadata`。
 */
export interface SkillMeta {
  /**
   * Skill 名称。
   * - 1-64 字符
   * - 仅允许小写字母、数字、连字符（a-z, 0-9, -）
   * - 不能以 `-` 开头或结尾
   * - 不能出现连续 `--`
   * - 必须与所在目录名一致
   */
  name: string;
  /**
   * Skill 描述。
   * - 1-1024 字符
   * - 同时说明"做什么"和"何时使用"，便于 Agent 进行触发匹配
   */
  description: string;
  /** SPDX 标识或对捆绑 LICENSE 文件的引用，例如 `Apache-2.0`、`Proprietary. LICENSE.txt has complete terms` */
  license?: string;
  /** 环境约束，如目标产品、系统包、网络访问等。1-500 字符 */
  compatibility?: string;
  /** 任意 key-value 扩展元信息，建议 key 命名加前缀避免冲突 */
  metadata?: Record<string, string>;
  /** 实验性：空格分隔的预批准工具列表，如 `Bash(git:*) Read` */
  "allowed-tools"?: string;
}

/**
 * 轻量校验：返回错误数组（空数组表示通过）。
 */
export function validateSkillMeta(input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return ["meta 必须是对象"];
  }
  const m = input as Record<string, unknown>;

  if (typeof m.name !== "string") {
    errors.push("name 必须是字符串");
  } else if (!isValidSkillName(m.name)) {
    errors.push(
      "name 必须为 1-64 字符的 kebab-case，且不能以 `-` 开头/结尾或出现连续 `--`",
    );
  }

  if (typeof m.description !== "string") {
    errors.push("description 必须是字符串");
  } else if (m.description.length < 1 || m.description.length > 1024) {
    errors.push("description 长度需在 1-1024 字符之间");
  }

  if (m.license !== undefined && typeof m.license !== "string") {
    errors.push("license 必须是字符串");
  }

  if (m.compatibility !== undefined) {
    if (typeof m.compatibility !== "string") {
      errors.push("compatibility 必须是字符串");
    } else if (m.compatibility.length < 1 || m.compatibility.length > 500) {
      errors.push("compatibility 长度需在 1-500 字符之间");
    }
  }

  if (m.metadata !== undefined) {
    if (
      typeof m.metadata !== "object" ||
      m.metadata === null ||
      Array.isArray(m.metadata)
    ) {
      errors.push("metadata 必须是对象");
    } else {
      for (const [k, v] of Object.entries(
        m.metadata as Record<string, unknown>,
      )) {
        if (typeof v !== "string") {
          errors.push(`metadata.${k} 必须是字符串`);
        }
      }
    }
  }

  if (
    m["allowed-tools"] !== undefined &&
    typeof m["allowed-tools"] !== "string"
  ) {
    errors.push("allowed-tools 必须是字符串");
  }

  return errors;
}

/**
 * Skill name 命名规则检查（与 agentskills.io 规范一致）。
 */
export function isValidSkillName(name: string): boolean {
  if (name.length < 1 || name.length > 64) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) return false;
  if (name.includes("--")) return false;
  return true;
}
