#!/usr/bin/env node
/**
 * {{skillName}} Skill entry.
 * Uses `createRouter` to handle --help / required args / error normalization.
 */
import { createRouter } from "skill-kits/runtime";
import { runHello } from "./commands/hello.js";

/**
 * `name` / `description` appear at the top of `--help`, telling the caller (LLM)
 * what this Skill does. Example:
 *
 *   $ node scripts/main.mjs --help
 *   {{skillName}} — one-line description of what this Skill does
 *
 *   Usage:
 *     node scripts/main.mjs <command> [options]
 *
 *   Commands:
 *     hello            example command, echoes input
 *
 *   Common options:
 *     --help, -h        show help
 */
const router = createRouter({
  name: "{{skillName}}",
  description: "one-line description of what this Skill does",
  // If every command needs the same context args (e.g. --domain / --token),
  // declare `commonArgs` here; they are injected into every command and typed.
  //   commonArgs: {
  //     domain: { type: "string", required: true, desc: "API domain" },
  //     token: { type: "string", required: true, desc: "auth token" },
  //   },
});

/**
 * Each subcommand's `description` shows in the top-level `--help` command list;
 * `args[*].desc` shows in the `<command> --help` subcommand help.
 */
router.command({
  name: "hello",
  description: "example command, echoes input",
  args: {
    message: { type: "string", required: true, desc: "text to echo back" },
  },
  handler({ message }) {
    runHello(message);
  },
});

router.run(process.argv.slice(2));
