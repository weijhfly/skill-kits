import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { renderTemplate } from '../template.js'
import { isValidSkillName, log, templatesRoot } from '../utils.js'

export interface NewOptions {
  /** Workspace 根目录（含 pnpm-workspace.yaml），默认 cwd */
  cwd?: string
}

/**
 * 在 workspace 中初始化一个新 Skill：仅按 name 渲染标准模板，
 */
export async function runNew(name: string, options: NewOptions = {}): Promise<void> {
  if (!isValidSkillName(name)) {
    throw new Error(
      `Skill 名称非法：${name}。需符合 kebab-case（a-z, 0-9, -），且不能以 - 开头/结尾或出现 --。`,
    )
  }

  const cwd = resolve(options.cwd ?? process.cwd())
  const workspaceFile = join(cwd, 'pnpm-workspace.yaml')
  if (!existsSync(workspaceFile)) {
    throw new Error(
      `未在 ${cwd} 找到 pnpm-workspace.yaml。请先执行 \`npx skill-kits init\`，或通过 --cwd 指定 workspace 根目录。`,
    )
  }
  const skillDir = join(cwd, 'packages', 'skills', name)
  if (existsSync(skillDir)) {
    throw new Error(`Skill 目录已存在：${skillDir}`)
  }

  log.info(`正在创建 Skill ${log.bold(name)} → ${skillDir}`)

  await renderTemplate(`${templatesRoot()}/skill-basic`, skillDir, {
    vars: {
      skillName: name,
    },
  })

  log.success(`Skill ${name} 创建完成。`)
  log.dim('')
  log.dim('后续步骤：')
  log.dim(
    `  1. 编辑 ${join('packages/skills', name, 'SKILL.md')} 完善 description / 触发条件 / 命令清单`,
  )
  log.dim(
    `  2. 在 ${join('packages/skills', name, 'references')} 放长文档，在 assets/ 放模板/资源【可选】`,
  )
  log.dim('  3. pnpm install')
  log.dim(`  4. pnpm dev ${name}`)
  log.dim(`  5. pnpm build ${name}`)
}
