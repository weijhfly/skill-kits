# skill-kits

> [English](https://github.com/weijhfly/skill-kits/blob/main/README.md) | **中文**

> Skill 工程化 —— 用 TypeScript 写 Agent Skill，编译为单文件 ESM，零依赖运行。  
> 产物遵循 [agentskills.io 规范](https://agentskills.io/specification)，运行需 Node.js >= 18。

## Why skill-kits？

| 痛点                             | 解法                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 公共模块无法复用                 | `skill-kits/runtime` 内置 HTTP、路由、输出、错误等工具，直接 import；`init` 生成的 monorepo 自带 `packages/shared`，esbuild 自动内联产物 |
| 没有标准模版                     | `pnpm new <name>` 生成对齐规范的 SKILL.md + 工程骨架                                                                                     |
| JS 无类型补全，TS 又依赖 tsc/bun | 用 TS 写 Skill 享受类型补全；`pnpm build` 用 esbuild 秒级打包为单文件 `main.mjs`，产物零依赖，Agent 端只需 Node 即可运行                 |
| 缺乏质量检测                     | `pnpm lint` 校验 SKILL.md 的 name/dir 一致性、行数、引用合法性、description 触发性；`build` 默认先跑 lint                                |

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
```

## 快速开始

```bash
pnpm new daily-report              # 新增 Skill
pnpm dev daily-report --out ~/.agent/skills   # watch + 同步到 agent 目录
pnpm build daily-report            # 编译（自动 lint + zip）
pnpm test daily-report             # 运行单测
```

## 写 TS，跑 JS

```
      源码                                 产物
┌──────────────────┐           ┌──────────────────────────┐
│  src/main.ts     │           │  dist/                   │
│  src/commands/   │  build    │  ├── <skill-name>/       │
│  references/     │ ───────►  │  │   ├── SKILL.md        │
│  assets/         │  esbuild  │  │   ├── scripts/        │
│  SKILL.md        │           │  │   │   └── main.mjs    │
└──────────────────┘           │  │   ├── references/     │
                               │  │   └── assets/         │
                               │  └── <skill-name>.zip    │
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
| `pnpm test [name]`          | 运行 Skill 单测（`src/**/*.test.ts`，基于 node:test + tsx）  |
| `pnpm pack <name>`          | 将 `dist/<name>/` 打包为 `dist/<name>.zip`（build 默认自动执行） |

### 选项

| 命令    | 选项                | 说明                                                           |
| ------- | ------------------- | -------------------------------------------------------------- |
| `init`  | `-n, --name <name>` | 项目名称，缺省取目标目录名                                     |
|         | `--locale <locale>` | 界面 / 模板语言：`en` \| `zh-CN`（默认按环境探测）             |
| `new`   | `--cwd <dir>`       | workspace 根目录（默认当前目录）                                |
|         | `--locale <locale>` | 模板语言；默认取工作区配置，再回落到环境探测                  |
| `build` | `--minify`          | 压缩产物 JS                                                    |
|         | `--no-lint`         | 跳过构建前 lint                                                |
|         | `--no-pack`         | 跳过构建后打包 zip                                             |
| `dev`   | `--out <dir>`       | 产物输出到 `<dir>/<name>/`，常用于直接同步到 agent skills 目录 |
|         | `--no-sourcemap`    | 关闭 sourcemap（默认 inline）                                  |
|         | `--run [args]`      | 重编后自动 `node <bundle> [args]`，用于本地快速回归            |
| `lint`  | `--strict`          | 把 warn 视作 error                                             |
| `test`  | `--watch`           | 监听文件变化自动重跑单测                                       |
| `pack`  | `--cwd <dir>`       | workspace 根目录（默认当前目录）                               |
| 所有    | `--cwd <dir>`       | workspace 根目录（默认当前目录）                               |

## 运行时 API

从 `skill-kits/runtime` 导入，编译时自动内联进产物。

### 命令路由

`createRouter` 自动处理 `--help`、必填参数校验、错误归一化：

```ts
import { createRouter, writeResult } from "skill-kits/runtime";

const router = createRouter({
  name: "daily-report",
  description: "...",
  commonArgs: {
    // 每个子命令都自动注入的公共参数
    domain: { type: "string", required: true, desc: "平台域名" },
    token: { type: "string", required: true, desc: "SSO token" },
  },
});

router.command({
  name: "fetch",
  description: "拉取昨日数据",
  args: {
    date: { type: "string", required: true, desc: "YYYY-MM-DD" },
    limit: { type: "number", default: 100, desc: "条数上限" },
    tag: { type: "list", desc: "过滤标签，可重复" },
    env: { type: "string", choices: ["boe", "online"] as const, desc: "环境" },
    filter: { type: "json", desc: "复杂过滤条件，JSON 自动解析" },
  },
  async handler({ date, limit, tag, env, filter, domain, token }) {
    // env 类型为 "boe" | "online"（choices 推断），filter 已自动 JSON.parse
    writeResult({ ok: true, items: [] });
  },
});

router.run(process.argv.slice(2));
```

`args` / `commonArgs` 支持 5 种类型：`string` / `number` / `boolean` / `list` / `json`。`required` 缺失时自动抛 `UserInputError`；`choices` 限定枚举值并提供类型推断；`type: "json"` 自动 `JSON.parse`。

### 输出

```ts
writeResult(payload)                                  // stdout，单行 JSON，供 Agent 消费
writeError(errorOrMessage, { code?, extra? })         // stderr + exitCode=1
notify(message)                                       // stderr，进度/阶段提示（ℹ️ 前缀）
handleCliError(error)                                 // 顶层 catch 兜底，自动识别 SkillError 子类
```

### HTTP

零依赖，基于全局 `fetch`（Node 18+）。不抛错——网络异常 / 非 2xx 都通过 `res.ok` 表达，业务自行决定如何处理：

```ts
import { httpGet, httpPost } from "skill-kits/runtime";

const res = await httpGet<UserInfo>("https://api.example.com/me", {
  headers: { authorization: `Bearer ${token}` },
  query: { fields: "id,name" },
  timeoutMs: 10_000,
});
if (!res.ok) throw new HttpError(res.status, url, res.statusText);
console.log(res.data?.name);
```

`HttpRequestOptions`：`headers` / `query` / `body` / `signal` / `timeoutMs` / `redirect`。

需要 PUT / DELETE 等方法可用 `httpRequest`，完整参数见 `node_modules/skill-kits/dist/runtime/http.d.ts`。

### 环境变量

读取环境变量工具方法，`requireEnv` 缺失时统一抛 `USER_INPUT_ERROR`（code=`USER_INPUT_ERROR`，details 含 `{ env: "变量名" }`），LLM 可据此引导用户配置：

```ts
import { requireEnv, optionalEnv } from "skill-kits/runtime";

const token = requireEnv("OPENAPI_TOKEN", {
  hint: "申请地址：https://example.com/get-token",
});
// 未设置 → stderr: { "ok": false, "code": "USER_INPUT_ERROR", "error": "缺少环境变量 OPENAPI_TOKEN。申请地址：..." }

const pat = optionalEnv("FIGMA_PERSONAL_ACCESS_TOKEN"); // string | null
```

### 轮询心跳

长轮询场景（D2C 生码、SSO 回调等）可以用 `sleepWithHeartbeat` 替代 `setTimeout`，每 5 秒往 stderr 写一次进度，防止 Agent 误判 idle 杀进程：

```ts
import { sleepWithHeartbeat } from "skill-kits/runtime";

await sleepWithHeartbeat(60_000, {
  message: (rem) => `等待生码... 剩余 ${rem}s`,
});
// stderr 每 5s: ℹ️ 等待生码... 剩余 55s
// stderr 每 5s: ℹ️ 等待生码... 剩余 50s
// ...
```

`SleepWithHeartbeatOptions`：`intervalMs` / `message`（字符串或函数）。

### 错误体系

所有业务错误继承 `SkillError`，`handleCliError` 会自动识别子类并输出结构化 JSON 到 stderr。内置错误码供 LLM 匹配对应处理策略：

| 类                 | code               | 场景                     |
| ------------------ | ------------------ | ------------------------ |
| `UserInputError`   | `USER_INPUT_ERROR` | 参数缺失 / 格式错误      |
| `AuthError`        | `AUTH_ERROR`       | Token 过期 / 权限不足    |
| `HttpError`        | `HTTP_ERROR`       | 上游 HTTP 非 2xx         |
| `BusinessApiError` | `BIZ_<code>`       | HTTP 200 但业务 code ≠ 0 |

```ts
import {
  SkillError,
  UserInputError,
  BusinessApiError,
} from "skill-kits/runtime";

// UserInputError：参数校验失败
throw new UserInputError("activityId 不能为空", { field: "activityId" });
// stderr → {"ok":false,"code":"USER_INPUT_ERROR","error":"activityId 不能为空","details":{"field":"activityId"}}

// 自定义 BusinessApiError 错误
throw new BusinessApiError(-10000, "token 过期", {
  hintMap: { [-10000]: "请重新登录", [-14]: "记录不存在" },
});
// stderr → {"ok":false,"code":"BIZ_-10000","error":"[code=-10000] token 过期（请重新登录）"}

// 自定义业务错误：继承 SkillError，code 自由命名
class RateLimitError extends SkillError {
  constructor(retryAfterSec?: number) {
    super("RATE_LIMIT", "请求过于频繁", { retryAfterSec });
  }
}
throw new RateLimitError(30);
// stderr → {"ok":false,"code":"RATE_LIMIT","error":"请求过于频繁","details":{"retryAfterSec":30}}
```

## 单元测试

Skill 单测遵循 `packages/skills/<name>/src/**/*.test.ts` 约定，通过 `pnpm test [name]` 运行（基于 `node:test` + `tsx`，零额外配置）。最常见的目标是**测试命令的出口行为**——调用命令函数，再断言写到 stdout 的 JSON 与 `exitCode`。`skill-kits/testing` 为此提供两个工具；`mockFetch` 仅在命令发起网络请求时才需要，纯逻辑直接断言即可：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mockFetch, captureOutput } from "skill-kits/testing";
import { toSeconds } from "./utils.js";
import { createActivity } from "./create-activity.js";

const ctx = { domain: "https://example.com", token: "t" }; // 已解析的 commonArgs

// 1) 纯函数 —— 无需任何工具。
test("toSeconds 把毫秒归一为秒", () => {
  assert.equal(toSeconds(1717000000000), 1717000000);
});

// 2) 成功路径 —— captureOutput 包裹 handler；mockFetch 假造 HTTP。
test("create 返回 ok 并携带后端数据", async () => {
  const mock = mockFetch([
    { match: /\/activity\/create/, json: { code: 0, data: { activity_id: 9001 } } },
  ]);
  try {
    const { json, exitCode } = await captureOutput(() =>
      createActivity(ctx, { act_name: "测试活动" }),
    );
    assert.equal(exitCode, 0);
    assert.equal((json as { activity_id: number }).activity_id, 9001);
  } finally {
    mock.restore();
  }
});

// 3) 错误路径 —— 命令函数会 throw SkillError（由 router 在顶层映射为
//    exit 1 + stderr JSON），因此对抛出的错误做断言。
test("缺少必填参数时抛错", async () => {
  await assert.rejects(
    () => captureOutput(() => createActivity(ctx, {})),
    "必填",
  );
});
```

- `captureOutput(fn)` —— 捕获 `writeResult` / `writeError` / `notify` 的输出与 `process.exitCode`，返回 `{ stdout, stderr, json, exitCode }`（`json` 为 stdout 自动解析的结果）。即使 `fn` 抛错也会还原。用于成功路径；错误路径下命令函数会 `throw`，请改用 `assert.rejects`。
- `mockFetch(routes)` —— 替换全局 `fetch`，按子串 / 正则 / 函数匹配，返回 `json` / `text` / `status` 或自定义 `response`。未匹配的请求会抛错，避免漏 mock 被静默放过。结束在 `finally` 里调 `.restore()` 还原。
- 并非每个测试都需要 `mockFetch` —— 纯函数直接 import 后断言即可。

## 业务公共模块

`runtime` 解决基础设施复用，业务领域的工具/常量/客户端走 `packages/shared`：

```bash
# 在 Skill 子包的 package.json 中加依赖
# "dependencies": { "@skills/shared": "workspace:*" }
pnpm install
```

```ts
// 在 packages/shared/src/index.ts 中导出你的工具/常量/客户端，
// 然后在任意 Skill 中 import：
// import { yourHelper } from "@skills/shared";
```

构建时 esbuild 把 `@skills/shared` 内联进产物，依旧是零依赖单文件。不需要则保持空目录即可。

## 渐进式披露

长文档放 `references/`、资产放 `assets/`，Agent 在 SKILL.md 中按需引用，避免一次性加载污染上下文。引用方式参见 [agentskills.io 规范](https://agentskills.io/specification)。

## 语言

skill-kits 以英文为基准；CLI 输出和生成的模板会跟随解析出的 locale（`en` 或 `zh-CN`）。locale 按如下优先级解析：

1. `--locale <locale>` 选项（`init` / `new`）
2. `SKILL_KITS_LOCALE` 环境变量
3. workspace `.skillkitrc.json` 里的 `locale` 字段（`new` 会读取）
4. `LC_ALL` / `LANG` 环境变量
5. 回落到 `en`

`init` 会把解析出的 locale 写入 `.skillkitrc.json`，`new` 自动继承，从而保证同一 workspace 内一致。模板可提供形如 `<base>.<locale>.<ext>` 的本地化覆盖文件（例如 `SKILL.zh-CN.md` 覆盖 `SKILL.md`）；仅命中当前 locale 的变体会被输出，且以基础文件名落盘。

```jsonc
// .skillkitrc.json
{ "locale": "zh-CN" }
```

## 配置

在 workspace 根目录放 `.skillkitrc.json` 可自定义 lint 行为：

```json
{
  // "locale": "zh-CN",  // 见上方"语言"章节
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
