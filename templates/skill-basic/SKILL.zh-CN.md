---
name: {{skillName}}
description: >
  用 1 句话概述核心能力（动词开头，例如：通过 X 平台 OpenAPI 完成 Y 任务）。
  当用户提到「关键词 A / 关键词 B」或要求「执行 Y 操作」时调用。
  不用于：与 X 无关的场景 / 非 Y 领域的任务（可列举 1-2 个容易误命中的反例）。
metadata:
  author: your-name
  version: "1.0.0"
---

# {{skillName}}

<!-- 用 1-2 句话概述核心工作流程，例如：通过 Figma 链接生成代码并提交到仓库。 -->

## 命令清单

### `hello`

回显输入内容。

| 参数        | 类型   | 必填 | 说明           |
| ----------- | ------ | ---- | -------------- |
| `--message` | string | ✅   | 需要回显的文本 |

```bash
node scripts/main.mjs hello --message "你好"
# → {"ok":true,"echo":"你好"}
```

> 参数详情见 [references/api.md](references/api.md)（如有）。

## 失败处理

| 场景         | 处理                                   |
| ------------ | -------------------------------------- |
| 参数缺失     | 补全必填参数后重试                     |
| 鉴权失败     | 重新获取 Token                         |
| 上游接口异常 | 根据错误码判断是否临时故障，必要时重试 |

> 完整错误码见 [references/errors.md](references/errors.md)（如有）。

## 注意事项

- 运行环境：Node.js >= 18
- 所有命令支持 `--help` 查看参数说明
