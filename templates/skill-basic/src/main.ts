#!/usr/bin/env node
/**
 * {{skillName}} Skill 入口。
 * 使用 `createRouter` 自动处理 --help / 必填参数 / 错误归一化。
 */
import { createRouter } from "skill-kits/runtime";
import { runHello } from "./commands/hello.js";

/**
 * `name` / `description` 会出现在 `--help` 顶部，用于告诉调用方（LLM）
 * 这个 Skill 是干什么的。示例：
 *
 *   $ node scripts/main.mjs --help
 *   {{skillName}} — 一句话描述本 Skill 做什么
 *
 *   用法：
 *     node scripts/main.mjs <command> [options]
 *
 *   命令：
 *     hello            示例命令，回显输入
 *
 *   公共参数：
 *     --help, -h        查看帮助
 */
const router = createRouter({
  name: "{{skillName}}",
  description: "一句话描述本 Skill 做什么",
});

/**
 * 每个子命令的 `description` 会展示在顶层 `--help` 的命令列表里；
 * `args[*].desc` 则展示在 `<command> --help` 子命令帮助里。
 */
router.command({
  name: "hello",
  description: "示例命令，回显输入",
  args: {
    message: { type: "string", required: true, desc: "需要回显的文本" },
  },
  handler({ message }) {
    runHello(message);
  },
});

router.run(process.argv.slice(2));
