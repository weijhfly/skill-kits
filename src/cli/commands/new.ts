import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyWorkspaceLocale, t } from "../i18n.js";
import { renderTemplate } from "../template.js";
import { type Locale, isValidSkillName, log, templatesRoot } from "../utils.js";

export interface NewOptions {
  /** Workspace 根目录（含 pnpm-workspace.yaml），默认 cwd */
  cwd?: string;
  /** 模板语言；缺省读取 workspace 的 .skillkitrc.json，再回落环境探测。 */
  locale?: string;
}

/**
 * 在 workspace 中初始化一个新 Skill：仅按 name 渲染标准模板，
 */
export async function runNew(
  name: string,
  options: NewOptions = {},
): Promise<void> {
  const cwd = resolve(options.cwd ?? process.cwd());
  // locale 解析优先级：显式 --locale > workspace 配置 > 环境探测。
  const locale: Locale = applyWorkspaceLocale(cwd, options.locale);

  if (!isValidSkillName(name)) {
    throw new Error(t("skill.invalidName", { name }));
  }

  const workspaceFile = join(cwd, "pnpm-workspace.yaml");
  if (!existsSync(workspaceFile)) {
    throw new Error(t("new.workspaceMissing", { cwd }));
  }
  const skillDir = join(cwd, "packages", "skills", name);
  if (existsSync(skillDir)) {
    throw new Error(t("new.dirExists", { dir: skillDir }));
  }

  log.info(t("new.start", { name: log.bold(name), dir: skillDir }));

  await renderTemplate(`${templatesRoot()}/skill-basic`, skillDir, {
    vars: {
      skillName: name,
    },
    locale,
  });

  log.success(t("new.done", { name }));
  log.dim("");
  log.dim(t("new.nextSteps"));
  log.dim(t("new.step1", { path: join("packages/skills", name, "SKILL.md") }));
  log.dim(t("new.step2", { path: join("packages/skills", name, "references") }));
  log.dim("  3. pnpm install");
  log.dim(`  4. pnpm dev ${name}`);
  log.dim(`  5. pnpm build ${name}`);
  log.dim(`  6. pnpm test ${name}`);
}
