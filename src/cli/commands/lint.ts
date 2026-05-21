import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { lintSkill, type LintReport } from '../../builder/lint.js'
import { log } from '../utils.js'

export interface LintCmdOptions {
  cwd?: string
  /** 把 warn 视作 error，CI 友好。 */
  strict?: boolean
}

async function listSkills(workspaceCwd: string): Promise<string[]> {
  const root = join(workspaceCwd, 'packages', 'skills')
  if (!existsSync(root)) return []
  const entries = await readdir(root, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

export async function runLint(
  name: string | undefined,
  options: LintCmdOptions = {},
): Promise<void> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const targets = name ? [name] : await listSkills(cwd)
  if (targets.length === 0) {
    throw new Error('当前 workspace 下没有可校验的 Skill。')
  }

  let totalErr = 0
  let totalWarn = 0
  const reports: LintReport[] = []

  for (const target of targets) {
    const skillDir = join(cwd, 'packages', 'skills', target)
    if (!existsSync(skillDir)) {
      log.error(`Skill 不存在: ${target}`)
      totalErr += 1
      continue
    }
    log.info(`正在校验 ${log.bold(target)}`)
    const report = await lintSkill(skillDir)
    reports.push(report)

    for (const item of report.items) {
      const where = `[${item.rule}]`
      if (item.level === 'error') {
        log.error(`  ${where} ${item.message}`)
        totalErr += 1
      } else if (item.level === 'warn') {
        log.warn(`  ${where} ${item.message}`)
        totalWarn += 1
      } else {
        log.dim(`  ${where} ${item.message}`)
      }
    }
    log.dim(
      `  统计：body ${report.stats.bodyLines} 行 / ${report.stats.bodyChars} 字符；description ${report.stats.descriptionChars} 字符`,
    )
  }

  log.dim(`workspace: ${relative(process.cwd(), cwd) || '.'}`)
  if (totalErr > 0) {
    log.error(`校验失败：${totalErr} 个错误，${totalWarn} 个警告`)
    process.exitCode = 1
    return
  }
  if (options.strict && totalWarn > 0) {
    log.error(`严格模式失败：${totalWarn} 个警告`)
    process.exitCode = 1
    return
  }
  log.success(`校验通过（${totalWarn} 个警告）`)
}
