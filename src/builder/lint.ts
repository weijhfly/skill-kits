/**
 * SKILL.md 静态校验：
 * - name 必须等于父目录名
 * - SKILL.md body 行数（warn @ 400 / fail @ 500）
 * - body 里的 markdown 链接必须是相对路径，且深度 ≤ 1（references/x.md 而非 ../foo）
 * - description 触发性 lint：长度（warn）、是否含「何时使用」线索（info）、反例（info）
 * - 未知 frontmatter key 警告
 *
 * 可选配置：在 workspace 根目录放 `.skillkitrc.json`，结构：
 *   {
 *     "lint": {
 *       "triggerHints": ["何时", "trigger", "use when"],
 *       "negativeHints": ["不要", "do not"],
 *       "descriptionMinChars": 80,
 *       "bodyLinesWarn": 400,
 *       "bodyLinesFail": 500
 *     }
 *   }
 *
 * 输出：返回 LintReport，CLI 侧渲染。
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseSkillMd } from "./skill-md.js";

export type LintLevel = "error" | "warn" | "info";

export interface LintItem {
  level: LintLevel;
  rule: string;
  message: string;
}

export interface LintReport {
  skillDir: string;
  items: LintItem[];
  hasError: boolean;
  hasWarn: boolean;
  stats: {
    bodyLines: number;
    bodyChars: number;
    descriptionChars: number;
  };
}

interface LintConfig {
  triggerHints: string[];
  negativeHints: string[];
  descriptionMinChars: number;
  bodyLinesWarn: number;
  bodyLinesFail: number;
}

const KNOWN_FRONTMATTER_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

const DEFAULT_TRIGGER_HINTS = [
  "何时",
  "触发",
  "用户提到",
  "用户要求",
  "use when",
  "trigger",
  "when the user",
];

const DEFAULT_NEGATIVE_HINTS = [
  "不要",
  "do not",
  "don't",
  "avoid",
  "禁用",
  "禁止",
  "不应",
];

const DEFAULTS: LintConfig = {
  triggerHints: DEFAULT_TRIGGER_HINTS,
  negativeHints: DEFAULT_NEGATIVE_HINTS,
  descriptionMinChars: 80,
  bodyLinesWarn: 400,
  bodyLinesFail: 500,
};

/**
 * 沿 skillDir 向上查找最近的 `.skillkitrc.json`，与 DEFAULTS 浅合并。
 * 找不到时返回默认配置。
 */
async function loadLintConfig(skillDir: string): Promise<LintConfig> {
  let dir = skillDir;
  for (let i = 0; i < 8; i++) {
    const file = join(dir, ".skillkitrc.json");
    if (existsSync(file)) {
      try {
        const raw = await readFile(file, "utf8");
        const parsed = JSON.parse(raw);
        const lint = (parsed?.lint ?? {}) as Partial<LintConfig>;
        return {
          triggerHints: Array.isArray(lint.triggerHints)
            ? lint.triggerHints
            : DEFAULTS.triggerHints,
          negativeHints: Array.isArray(lint.negativeHints)
            ? lint.negativeHints
            : DEFAULTS.negativeHints,
          descriptionMinChars:
            typeof lint.descriptionMinChars === "number"
              ? lint.descriptionMinChars
              : DEFAULTS.descriptionMinChars,
          bodyLinesWarn:
            typeof lint.bodyLinesWarn === "number"
              ? lint.bodyLinesWarn
              : DEFAULTS.bodyLinesWarn,
          bodyLinesFail:
            typeof lint.bodyLinesFail === "number"
              ? lint.bodyLinesFail
              : DEFAULTS.bodyLinesFail,
        };
      } catch {
        // 配置文件解析失败时退回默认，避免 lint 链路被破坏。
        return DEFAULTS;
      }
    }
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return DEFAULTS;
}

export async function lintSkill(skillDir: string): Promise<LintReport> {
  const items: LintItem[] = [];
  const skillMdPath = `${skillDir}/SKILL.md`;
  const meta = await parseSkillMd(skillMdPath);
  const config = await loadLintConfig(skillDir);
  const bodyLines = meta.body.split(/\r?\n/).length;
  const stats = {
    bodyLines,
    bodyChars: meta.body.length,
    descriptionChars: (meta.description ?? "").length,
  };

  // 1. name 与父目录名
  const dirName = basename(skillDir);
  if (meta.name !== dirName) {
    items.push({
      level: "error",
      rule: "name-matches-dir",
      message: `name (${meta.name}) 必须等于父目录名 (${dirName})`,
    });
  }

  // 2. body 行数
  if (bodyLines > config.bodyLinesFail) {
    items.push({
      level: "error",
      rule: "body-line-limit",
      message: `SKILL.md body ${bodyLines} 行 > ${config.bodyLinesFail}，请把详细内容拆到 references/`,
    });
  } else if (bodyLines > config.bodyLinesWarn) {
    items.push({
      level: "warn",
      rule: "body-line-soft",
      message: `SKILL.md body ${bodyLines} 行 > ${config.bodyLinesWarn}，建议拆分到 references/`,
    });
  }

  // 3. markdown 链接 / 资源引用合法性
  await lintReferences(skillMdPath, meta.body, items);

  // 4. description 触发性
  lintDescription(meta.description ?? "", items, config);

  // 5. 未知 frontmatter key
  await lintUnknownKeys(skillMdPath, items);

  const hasError = items.some((i) => i.level === "error");
  const hasWarn = items.some((i) => i.level === "warn");
  return { skillDir, items, hasError, hasWarn, stats };
}

function lintDescription(
  description: string,
  items: LintItem[],
  config: LintConfig,
): void {
  if (description.length < config.descriptionMinChars) {
    items.push({
      level: "warn",
      rule: "description-length",
      message: `description 仅 ${description.length} 字符，建议 ≥ ${config.descriptionMinChars}，更具体能有效降低欠触发`,
    });
  }
  // 触发线索 / 反例：仅 info 级别，避免对非中英文 Skill 误报。
  // 用户可在 .skillkitrc.json 配置 triggerHints / negativeHints。
  const lower = description.toLowerCase();
  if (!config.triggerHints.some((kw) => lower.includes(kw.toLowerCase()))) {
    items.push({
      level: "info",
      rule: "description-trigger",
      message:
        "description 未明显说明「何时触发」，建议加入「当用户提到 X / 要求 Y」这类触发线索",
    });
  }
  if (!config.negativeHints.some((kw) => lower.includes(kw.toLowerCase()))) {
    items.push({
      level: "info",
      rule: "description-negative",
      message:
        'description 建议补充「不要触发」的反例，避免与相邻 Skill 误命中（示例："不用于：与 X 无关的查询 / 通用 Y 任务"）',
    });
  }
}

async function lintReferences(
  _skillMdPath: string,
  body: string,
  items: LintItem[],
): Promise<void> {
  const linkRe = /\]\(([^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex iteration
  while ((m = linkRe.exec(body)) !== null) {
    const link = m[1] ?? "";
    if (!link) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue; // http(s) / mailto 等绝对协议
    if (link.startsWith("#")) continue; // 锚点
    if (link.startsWith("/")) {
      items.push({
        level: "error",
        rule: "ref-relative",
        message: `引用必须是相对路径: ${link}`,
      });
      continue;
    }
    if (link.startsWith("../")) {
      items.push({
        level: "error",
        rule: "ref-depth",
        message: `引用不允许越界（包含 ../）: ${link}`,
      });
      continue;
    }
    // 计算实际深度时剥离前导 `./`，避免把 `./references/x.md` 误算成两层
    const normalized = link.replace(/^(\.\/)+/, "");
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length > 2) {
      items.push({
        level: "warn",
        rule: "ref-depth",
        message: `引用建议不超过 1 层目录（references/x.md 或 assets/x）：${link}`,
      });
    }
  }
}

async function lintUnknownKeys(
  skillMdPath: string,
  items: LintItem[],
): Promise<void> {
  const raw = await readFile(skillMdPath, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return;
  let parsed: unknown;
  try {
    parsed = parseYaml(match[1] ?? "");
  } catch {
    // YAML 解析错误已经在 parseSkillMd 阶段抛出，这里忽略避免重复报错。
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
  for (const key of Object.keys(parsed as Record<string, unknown>)) {
    if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
      items.push({
        level: "warn",
        rule: "frontmatter-unknown-key",
        message: `frontmatter 出现未知 key: ${key}（agentskills.io 规范未定义）`,
      });
    }
  }
}
