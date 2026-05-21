/**
 * 命令路由微框架 —— Skill 多子命令场景的标准入口。
 *
 * 解决 main.ts 里手写 `switch(cmd)` 三处同步问题（USAGE / switch / handler），
 * 自动：
 * - 校验 required 参数（未提供则抛 UserInputError）
 * - 自动生成 `--help` / `-h`（顶层与子命令级）
 * - 顶层 catch，把 SkillError 通过 logger 输出到 stderr
 *
 * 使用：
 *   const router = createRouter({ name: "my-skill", description: "..." });
 *   router.command({
 *     name: "hello",
 *     description: "回显输入",
 *     args: { message: { type: "string", required: true, desc: "需要回显的文本" } },
 *     async handler({ message }) {
 *       writeResult({ ok: true, echo: message });
 *     },
 *   });
 *   await router.run(process.argv.slice(2));
 */
import { type ParsedArgv, parseArgv } from "./argv.js";
import { UserInputError } from "./errors.js";
import { handleCliError } from "./logger.js";

export type ArgType = "string" | "number" | "boolean" | "list";

export interface ArgSpec {
  type: ArgType;
  required?: boolean;
  desc?: string;
  default?: string | number | boolean | string[];
}

export type ArgsSchema = Record<string, ArgSpec>;

export type ResolvedArgs<S extends ArgsSchema> = {
  [K in keyof S]: S[K]["type"] extends "string"
    ? string
    : S[K]["type"] extends "number"
      ? number
      : S[K]["type"] extends "boolean"
        ? boolean
        : S[K]["type"] extends "list"
          ? string[]
          : never;
};

export interface CommandSpec<S extends ArgsSchema = ArgsSchema> {
  name: string;
  description: string;
  args?: S;
  handler: (args: ResolvedArgs<S>, raw: ParsedArgv) => Promise<void> | void;
}

export interface RouterOptions {
  name: string;
  description?: string;
  /**
   * 帮助信息中展示的启动方式，默认 `node scripts/main.mjs`。
   * 如果你的 skill 通过 `npx <pkg>` / `pnpm dev <name>` 启动，可在此覆盖。
   */
  usage?: string;
}

export interface Router {
  command<S extends ArgsSchema>(spec: CommandSpec<S>): Router;
  run(argv: string[]): Promise<void>;
  formatHelp(): string;
}

export function createRouter(options: RouterOptions): Router {
  const commands: CommandSpec<ArgsSchema>[] = [];
  const router: Router = {
    command(spec) {
      commands.push(spec as CommandSpec<ArgsSchema>);
      return router;
    },
    formatHelp() {
      return formatHelp(options, commands);
    },
    async run(argv) {
      const opts = parseArgv(argv);
      const cmd = opts._[0];
      const wantHelp = opts.help === true || opts.h === true;

      if (!cmd) {
        process.stderr.write(`${formatHelp(options, commands)}\n`);
        return;
      }

      const target = commands.find((c) => c.name === cmd);
      if (!target) {
        process.stderr.write(
          `未知命令: ${cmd}\n\n${formatHelp(options, commands)}\n`,
        );
        process.exitCode = 1;
        return;
      }

      // 子命令级 --help
      if (wantHelp) {
        process.stderr.write(`${formatCommandHelp(options, target)}\n`);
        return;
      }

      try {
        const resolved = resolveArgs(target, opts);
        await target.handler(resolved as never, opts);
      } catch (err) {
        handleCliError(err);
      }
    },
  };
  return router;
}

function resolveArgs(
  spec: CommandSpec<ArgsSchema>,
  opts: ParsedArgv,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const schema = spec.args ?? {};
  for (const [key, def] of Object.entries(schema)) {
    const raw = opts[key];
    if (raw === undefined) {
      if (def.required) {
        throw new UserInputError(`缺少必填参数: --${key}`);
      }
      out[key] = def.default ?? defaultFor(def.type);
      continue;
    }
    out[key] = coerce(key, raw, def.type);
  }
  return out;
}

function defaultFor(t: ArgType): unknown {
  switch (t) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "list":
      return [];
  }
}

function coerce(
  key: string,
  raw: string | boolean | string[],
  type: ArgType,
): unknown {
  switch (type) {
    case "string":
      if (typeof raw === "string") return raw;
      if (Array.isArray(raw)) return raw[raw.length - 1] ?? "";
      throw new UserInputError(`参数 --${key} 必须是字符串`);
    case "number": {
      if (Array.isArray(raw)) {
        throw new UserInputError(
          `参数 --${key} 不支持多次传入，请只指定一个数字`,
        );
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        throw new UserInputError(
          `参数 --${key} 必须是数字，收到: ${String(raw)}`,
        );
      }
      return n;
    }
    case "boolean":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "1") return true;
      if (raw === "false" || raw === "0") return false;
      throw new UserInputError(
        `参数 --${key} 必须是布尔（true/false/1/0），收到: ${String(raw)}`,
      );
    case "list":
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") return [raw];
      return [];
  }
}

function formatHelp(
  opts: RouterOptions,
  commands: CommandSpec<ArgsSchema>[],
): string {
  const usage = opts.usage ?? "node scripts/main.mjs";
  const lines: string[] = [];
  lines.push(`${opts.name} — ${opts.description ?? ""}`.trim());
  lines.push("");
  lines.push("用法：");
  lines.push(`  ${usage} <command> [options]`);
  lines.push("");
  lines.push("命令：");
  for (const c of commands) {
    lines.push(`  ${c.name.padEnd(16)} ${c.description}`);
  }
  lines.push("");
  lines.push("公共参数：");
  lines.push("  --help, -h        查看帮助");
  if (commands.length > 0) {
    lines.push("");
    lines.push(
      `提示：使用 \`${usage} <command> --help\` 查看具体子命令的参数。`,
    );
  }
  return lines.join("\n");
}

function formatCommandHelp(
  opts: RouterOptions,
  cmd: CommandSpec<ArgsSchema>,
): string {
  const usage = opts.usage ?? "node scripts/main.mjs";
  const lines: string[] = [];
  lines.push(`${opts.name} ${cmd.name} — ${cmd.description}`);
  lines.push("");
  lines.push("用法：");
  lines.push(`  ${usage} ${cmd.name} [options]`);
  lines.push("");
  lines.push("参数：");
  const args = cmd.args ?? {};
  if (Object.keys(args).length === 0) {
    lines.push("  （无）");
  } else {
    for (const [k, def] of Object.entries(args)) {
      const flag = `--${k}`;
      const tag = def.required ? "必填" : "可选";
      lines.push(
        `  ${flag.padEnd(16)} <${def.type}> [${tag}] ${def.desc ?? ""}`,
      );
    }
  }
  return lines.join("\n");
}
