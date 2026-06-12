/**
 * Shared business modules reused across Skills.
 *
 * Import via `@skills/shared` in a Skill sub-package; esbuild inlines it into
 * dist/<skill-name>/scripts/main.mjs. Usage:
 *   1. Add to the Skill's package.json dependencies: "@skills/shared": "workspace:*"
 *   2. Run `pnpm install`
 *   3. In source: import { greet } from "@skills/shared"
 */

export function greet(name: string): string {
  return `Hello, ${name}!`;
}
