# {{projectName}}

由 [skill-kits](https://www.npmjs.com/package/skill-kits) 初始化的 Skill 工作区。

## 快速开始

```bash
pnpm install
pnpm new my-first-skill  # 新建 Skill
pnpm dev my-first-skill  # 开发模式
pnpm build my-first-skill  # 构建 Skill 产物
```

> 用 AI agent 开发？参见 [`AGENTS.md`](./AGENTS.md)，里面列出了 `skill-kits/runtime`
> 与 `skill-kits/testing` 的可复用能力地图——优先复用，别自己重写 HTTP / 错误 / 输出 / 测试。

每个 Skill 的产物位于 `packages/skills/<name>/dist/<name>/`，包含：

- `SKILL.md` —— Agent 元信息（YAML frontmatter + 正文）
- `scripts/main.mjs` —— 通过 esbuild 打包后的零依赖 ESM 入口
- `references/` / `assets/` —— 若源码有则 mirror 过来

打包产物 `packages/skills/<name>/dist/<name>.zip` 与 zip 内根目录同名，可直接上传至 Agent Skill 平台。

## 目录结构

```
.
├── pnpm-workspace.yaml
├── package.json
└── packages/
    ├── shared/         # 跨 Skill 复用的业务公共模块（@skills/shared）
    └── skills/         # 每个 Skill 一个子包
        └── <name>/
            ├── src/
            ├── SKILL.md
            └── dist/
                ├── <name>/         # 产物 Skill 包
                │   ├── SKILL.md
                │   └── scripts/main.mjs
                └── <name>.zip      # 上传产物
```

## 业务公共模块

跨 Skill 复用的业务代码请放到 `packages/shared/`，在目标 Skill 的 `package.json` 里加依赖即可：

```json
{
  "dependencies": { "@skills/shared": "workspace:*" }
}
```

构建时 esbuild 会自动把 `@skills/shared` 内联进 `dist/<name>/scripts/main.mjs`，产物保持零依赖单文件。

## 常用命令

```bash
npx skill-kits new <name>             # 新建 Skill
npx skill-kits build [name]           # 构建（缺省构建全部），自动打包 dist/<name>.zip
npx skill-kits build <name> --no-pack # 仅构建，不打 zip
npx skill-kits dev <name>             # watch 模式：src/SKILL.md/references/assets 即时同步
npx skill-kits dev <name> --out <dir> # 把产物直接吐到 agent skills 目录，便于联调
npx skill-kits pack <name>            # 单独打包 dist/<name>.zip
```
