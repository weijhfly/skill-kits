import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { lintSkill, type LintReport } from '../../builder/lint.js'
import { applyWorkspaceLocale, t } from '../i18n.js'
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
  applyWorkspaceLocale(cwd)
  const targets = name ? [name] : await listSkills(cwd)
  if (targets.length === 0) {
    throw new Error(t('lint.noSkills'))
  }

  let totalErr = 0
  let totalWarn = 0
  const reports: LintReport[] = []

  for (const target of targets) {
    const skillDir = join(cwd, 'packages', 'skills', target)
    if (!existsSync(skillDir)) {
      log.error(t('skill.notFoundShort', { name: target }))
      totalErr += 1
      continue
    }
    log.info(t('lint.checking', { name: log.bold(target) }))
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
      t('lint.stats', {
        lines: report.stats.bodyLines,
        chars: report.stats.bodyChars,
        descChars: report.stats.descriptionChars,
      }),
    )
  }

  log.dim(t('lint.workspace', { path: relative(process.cwd(), cwd) || '.' }))
  if (totalErr > 0) {
    log.error(t('lint.failed', { errors: totalErr, warns: totalWarn }))
    process.exitCode = 1
    return
  }
  if (options.strict && totalWarn > 0) {
    log.error(t('lint.strictFailed', { warns: totalWarn }))
    process.exitCode = 1
    return
  }
  log.success(t('lint.passed', { warns: totalWarn }))
}
