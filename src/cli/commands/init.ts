import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import prompts from 'prompts'
import { renderTemplate } from '../template.js'
import { isValidSkillName, log, templatesRoot } from '../utils.js'

export interface InitOptions {
  /** 项目名，缺省则用目标目录名。 */
  name?: string
}

/**
 * 初始化一个 Skill 工作区到 `targetDir`。
 * 不再交互式 prompt，直接渲染模板，用户后续按需修改 package.json 即可。
 */
export async function runInit(targetDir: string, options: InitOptions = {}): Promise<void> {
  const dest = resolve(targetDir)

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `将在目录 (${dest}) 初始化 Skill 工作区，是否继续？`,
    initial: true,
  })

  if (!confirm) {
    log.info('已取消初始化。')
    return
  }

  if (existsSync(dest)) {
    const entries = await readdir(dest)
    if (entries.length > 0) {
      throw new Error(`目标目录非空: ${dest}`)
    }
  } else {
    await mkdir(dest, { recursive: true })
  }

  const projectName = options.name ?? basename(dest)
  if (!isValidSkillName(projectName)) {
    throw new Error(
      `项目名称非法：${projectName}。需符合 kebab-case（a-z, 0-9, -），且不能以 - 开头/结尾或出现 --。`,
    )
  }

  log.info(`正在初始化 ${log.bold(projectName)} → ${dest}`)
  await renderTemplate(`${templatesRoot()}/project`, dest, {
    vars: { projectName },
    rename: { _gitignore: '.gitignore' },
  })

  log.success('项目初始化完成。')
  log.dim('')
  log.dim('后续步骤：')
  if (targetDir !== '.') {
    log.dim(`  cd ${targetDir}`)
  }
  log.dim('  pnpm install')
  log.dim('  pnpm new my-first-skill')
  log.dim('  pnpm dev my-first-skill')
  log.dim('  pnpm build my-first-skill')
}
