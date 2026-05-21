# skill-kits

> Skill 工程化 —— 用 TypeScript 写 Agent Skill，编译为单文件 ESM，零依赖运行。

**Node.js >= 18** · [agentskills.io 规范](https://agentskills.io/specification) · MIT

## Why skill-kits？

| 痛点               | 解法                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 公共模块无法复用   | `skill-kits/runtime` 内置 HTTP、路由、输出、错误等工具，直接 import；`init` 生成的 monorepo 自带 `packages/shared`，esbuild 自动内联产物 |
| 没有标准模版       | `pnpm new <name>` 生成对齐规范的 SKILL.md + 工程骨架                                                                                     |
| TS 开发 vs JS 运行 | `pnpm build` 用 esbuild 打包 TS + 运行时为单个 `main.mjs`，自动 mirror references/assets，并 pack 成 zip                                 |
| 缺乏质量检测       | `pnpm lint` 校验 SKILL.md 的 name/dir 一致性、行数、引用合法性、description 触发性；`build` 默认先跑 lint                                |

## 安装

```bash
npx skill-kits init my-skills   # 或在当前目录：npx skill-kits init
cd my-skills && pnpm install
```

`init` 生成一个 pnpm monorepo：

```
my-skills/
├── pnpm-workspace.yaml
├── package.json
└── packages/
    ├── shared/        # 跨 Skill 复用的业务公共模块（@skills/shared）
    └── skills/        # 每个 Skill 一个子包，由 new 生成
        └── daily-report/
```

## 快速开始

```bash
pnpm new daily-report              # 新增 Skill
pnpm dev daily-report --out ~/.agent/skills   # watch + 同步到 agent 目录
pnpm build daily-report            # 编译（自动 lint + zip）
```

## 写 TS，跑 JS

```
      源码                                 产物
┌──────────────────┐           ┌──────────────────────────┐
│  src/main.ts     │           │  dist/                    │
│  src/commands/   │  build    │  ├── <skill-name>/        │
│  references/     │ ───────► │  │   ├── SKILL.md         │
│  assets/         │  esbuild  │  │   ├── scripts/         │
│  SKILL.md        │           │  │   │   └── main.mjs     │
└──────────────────┘           │  │   ├── references/      │
                               │  │   └── assets/          │
                               │  └── <skill-name>.zip     │
                               └──────────────────────────┘
  TypeScript + runtime import      单文件 ESM，零依赖
                                   Agent: node scripts/main.mjs
```

## CLI

> 在 `init` 生成的 workspace 里，已挂载 `pnpm new / dev / build / lint` 脚本，下表写法等价。

| 命令                        | 作用                                                         |
| --------------------------- | ------------------------------------------------------------ |
| `npx skill-kits init [dir]` | 生成 Skill 工作区骨架（缺省为当前目录）                      |
| `pnpm new <name>`           | 新增一个 Skill（含 references/ assets/ 占位）                |
| `pnpm build [name]`         | 编译 → 默认 lint + pack 成 `dist/<name>.zip`                 |
| `pnpm dev <name>`           | watch 模式，src/ + SKILL.md + references/ + assets/ 即时同步 |
| `pnpm lint [name]`          | 单独校验 SKILL.md                                            |

### 选项

| 命令    | 选项                | 说明                                                           |
| ------- | ------------------- | -------------------------------------------------------------- |
| `init`  | `-n, --name <name>` | 项目名称，缺省取目标目录名                                     |
| `build` | `--minify`          | 压缩产物 JS                                                    |
|         | `--no-lint`         | 跳过构建前 lint                                                |
|         | `--no-pack`         | 跳过构建后打包 zip                                             |
| `dev`   | `--out <dir>`       | 产物输出到 `<dir>/<name>/`，常用于直接同步到 agent skills 目录 |
|         | `--no-sourcemap`    | 关闭 sourcemap（默认 inline）                                  |
|         | `--run [args]`      | 重编后自动 `node <bundle> [args]`，用于本地快速回归            |
| `lint`  | `--strict`          | 把 warn 视作 error                                             |
| 所有    | `--cwd <dir>`       | workspace 根目录（默认当前目录）                               |

## 运行时 API

从 `skill-kits/runtime` 导入，编译时自动内联进产物。

### 命令路由

`createRouter` 自动处理 `--help`、必填参数校验、错误归一化：

```ts
import { createRouter, writeResult } from "skill-kits/runtime";

const router = createRouter({ name: "daily-report", description: "..." });

router.command({
  name: "fetch",
  description: "拉取昨日数据",
  args: {
    date: { type: "string", required: true, desc: "YYYY-MM-DD" },
    limit: { type: "number", default: 100, desc: "条数上限" },
    tag: { type: "list", desc: "过滤标签，可重复" },
  },
  async handler({ date, limit, tag }) {
    writeResult({ ok: true, items: [] });
  },
});

router.run(process.argv.slice(2));
```

`args` 支持 `string` / `number` / `boolean` / `list` 四种类型，`required` 字段缺失时自动抛 `UserInputError`。

### 输出

```ts
writeResult(payload, pretty?)   // stdout，单行 JSON，供 Agent 消费
writeError(errorOrMessage, { code?, extra?, setExitCode? })  // stderr + exitCode=1
notify(message)                 // stderr，进度/阶段提示（ℹ️ 前缀）
handleCliError(error)           // 顶层 catch 兜底，自动识别 SkillError 子类
```

### HTTP

零依赖，基于全局 `fetch`（Node 18+）

```ts
const res = await httpGet<UserInfo>("https://api.example.com/me", {
  headers: { authorization: `Bearer ${token}` },
  query: { fields: "id,name" },
  timeoutMs: 10_000,
});
if (!res.ok) throw new HttpError(res.status, url, res.statusText);
console.log(res.data?.name);
```

`HttpRequestOptions`：`headers` / `query` / `body` / `signal` / `timeoutMs` / `redirect`。

### 错误

```ts
class SkillError extends Error {
  code: string;
  details?: unknown;
}
class UserInputError extends SkillError {
  /* code: USER_INPUT_ERROR */
}
class AuthError extends SkillError {
  /* code: AUTH_ERROR */
}
class HttpError extends SkillError {
  status: number;
  url: string;
}
```

业务可继承 `SkillError` 自定义 code（如 `RATE_LIMIT` / `TIMEOUT`）。

## 业务公共模块

`runtime` 解决基础设施复用，业务领域的工具/常量/客户端走 `packages/shared`：

```bash
# 在 Skill 子包的 package.json 中加依赖
# "dependencies": { "@skills/shared": "workspace:*" }
pnpm install
```

```ts
import { greet } from "@skills/shared";
```

构建时 esbuild 把 `@skills/shared` 内联进产物，依旧是零依赖单文件。不需要则保持空目录即可。

## 渐进式披露

长文档放 `references/`、资产放 `assets/`，Agent 在 SKILL.md 中按需引用，避免一次性加载污染上下文。引用方式参见 [agentskills.io 规范](https://agentskills.io/specification)。

## 配置

在 workspace 根目录放 `.skillkitrc.json` 可自定义 lint 行为：

```json
{
  "lint": {
    "triggerHints": ["何时", "trigger", "use when"],
    "negativeHints": ["不要", "do not"],
    "descriptionMinChars": 80,
    "bodyLinesWarn": 400,
    "bodyLinesFail": 500
  }
}
```

## Lint 规则

| 规则                      | 级别         | 说明                                       |
| ------------------------- | ------------ | ------------------------------------------ |
| `name-matches-dir`        | error        | `name` 必须等于父目录名                    |
| `body-line-limit`         | error        | SKILL.md body > 500 行                     |
| `body-line-soft`          | warn         | SKILL.md body > 400 行，建议拆 references/ |
| `ref-relative`            | error        | 引用必须是相对路径                         |
| `ref-depth`               | error / warn | `../` 报 error；>1 层目录报 warn           |
| `description-length`      | warn         | description < 80 字符，过短易欠触发        |
| `description-trigger`     | info         | description 缺少「何时触发」线索           |
| `description-negative`    | info         | 建议补充「不要触发」反例                   |
| `frontmatter-unknown-key` | warn         | 出现规范未定义的 frontmatter key           |

## License

MIT
