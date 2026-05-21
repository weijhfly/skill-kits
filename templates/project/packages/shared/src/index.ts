/**
 * 跨 Skill 复用的业务公共模块。
 *
 * 在 Skill 子包中通过 `@skills/shared` 导入，esbuild 会自动内联到 dist/<skill-name>/scripts/main.mjs。
 * 用法：
 *   1. 在 skill 的 package.json dependencies 里添加: "@skills/shared": "workspace:*"
 *   2. 执行 `pnpm install`
 *   3. 在源码中: import { greet } from "@skills/shared"
 */

export function greet(name: string): string {
  return `Hello, ${name}!`;
}
