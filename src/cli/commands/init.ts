import { existsSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import prompts from 'prompts'
import { setLocale, t } from '../i18n.js'
import { renderTemplate } from '../template.js'
import { type Locale, isValidSkillName, log, resolveLocale, templatesRoot } from '../utils.js'

export interface InitOptions {
  /** 项目名，缺省则用目标目录名。 */
  name?: string
  /** UI / 模板语言，缺省按环境探测（SKILL_KITS_LOCALE / LANG）。 */
  locale?: string
}

/**
 * 初始化一个 Skill 工作区到 `targetDir`。
 * 不再交互式 prompt，直接渲染模板，用户后续按需修改 package.json 即可。
 */
export async function runInit(targetDir: string, options: InitOptions = {}): Promise<void> {
  const dest = resolve(targetDir)
  const locale: Locale = resolveLocale(options.locale)
  setLocale(locale)

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: t('init.confirm', { dest }),
    initial: true,
  })

  if (!confirm) {
    log.info(t('init.cancelled'))
    return
  }

  if (existsSync(dest)) {
    const entries = await readdir(dest)
    if (entries.length > 0) {
      throw new Error(t('init.dirNotEmpty', { dest }))
    }
  } else {
    await mkdir(dest, { recursive: true })
  }

  const projectName = options.name ?? basename(dest)
  if (!isValidSkillName(projectName)) {
    throw new Error(t('skill.invalidName', { name: projectName }))
  }

  log.info(t('init.start', { name: log.bold(projectName), dest }))
  await renderTemplate(`${templatesRoot()}/project`, dest, {
    vars: { projectName },
    rename: { _gitignore: '.gitignore' },
    locale,
  })

  // 记录 locale，供后续 `new` 继承，保持工作区内模板语言一致。
  await writeFile(
    join(dest, '.skillkitrc.json'),
    `${JSON.stringify({ locale }, null, 2)}\n`,
    'utf8',
  )

  log.success(t('init.done'))
  log.dim('')
  log.dim(t('init.nextSteps'))
  if (targetDir !== '.') {
    log.dim(`  cd ${targetDir}`)
  }
  log.dim('  pnpm install')
  log.dim('  pnpm new my-first-skill')
  log.dim('  pnpm dev my-first-skill')
  log.dim('  pnpm build my-first-skill')
  log.dim('  pnpm test my-first-skill')
}
