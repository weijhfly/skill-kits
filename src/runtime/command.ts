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
 *   const router = createRouter({
 *     name: "my-skill",
 *     description: "...",
 *     commonArgs: { domain: { type: "string", required: true, desc: "..." } },
 *   });
 *   router.command({
 *     name: "hello",
 *     description: "回显输入",
 *     args: { message: { type: "string", required: true, desc: "需要回显的文本" } },
 *     async handler({ message, domain }) {
 *       writeResult({ ok: true, echo: message, domain });
 *     },
 *   });
 *   await router.run(process.argv.slice(2));
 */
import { type ParsedArgv, parseArgv } from "./argv.js";
import { UserInputError } from "./errors.js";
import { handleCliError } from "./logger.js";

export type ArgType = "string" | "number" | "boolean" | "list" | "json";

export interface ArgSpec<T = unknown> {
  type: ArgType;
  required?: boolean;
  desc?: string;
  default?: string | number | boolean | string[] | T;
  /**
   * 仅 `type: "string"` 生效：限定取值范围，命中外抛 `UserInputError`。
   * 帮助文案会自动附上可选值。
   */
  choices?: readonly string[];
}

export type ArgsSchema = Record<string, ArgSpec>;

type ResolveType<S extends ArgSpec> = S["type"] extends "string"
  ? S["choices"] extends readonly (infer U)[]
    ? U
    : string
  : S["type"] extends "number"
    ? number
    : S["type"] extends "boolean"
      ? boolean
      : S["type"] extends "list"
        ? string[]
        : S["type"] extends "json"
          ? S extends ArgSpec<infer T>
            ? T
            : unknown
          : never;

export type ResolvedArgs<S extends ArgsSchema> = {
  [K in keyof S]: ResolveType<S[K]>;
};

export interface CommandSpec<
  S extends ArgsSchema = ArgsSchema,
  C extends ArgsSchema = ArgsSchema,
> {
  name: string;
  description: string;
  args?: S;
  handler: (
    args: ResolvedArgs<C> & ResolvedArgs<S> & Record<string, unknown>,
    raw: ParsedArgv,
  ) => Promise<void> | void;
}

export interface RouterOptions<C extends ArgsSchema = ArgsSchema> {
  name: string;
  description?: string;
  /**
   * 公共参数（每个命令都需要的连接 / 鉴权类参数），
   * 框架会在解析时自动注入到每个 handler 的 args 里，
   * 子命令仍可在 `args` 中覆盖同名定义。
   */
  commonArgs?: C;
}

export interface Router<C extends ArgsSchema = ArgsSchema> {
  command<S extends ArgsSchema>(spec: CommandSpec<S, C>): Router<C>;
  run(argv: string[]): Promise<void>;
}

export function createRouter<C extends ArgsSchema = ArgsSchema>(
  options: RouterOptions<C>,
): Router<C> {
  const commands: CommandSpec<ArgsSchema>[] = [];
  const commonArgs: ArgsSchema = options.commonArgs ?? {};
  const optsForHelp = options as RouterOptions<ArgsSchema>;
  const router: Router<C> = {
    command(spec) {
      commands.push(spec as CommandSpec<ArgsSchema>);
      return router;
    },
    async run(argv) {
      const opts = parseArgv(argv);
      const cmd = opts._[0];
      const wantHelp = opts.help === true || opts.h === true;

      if (!cmd) {
        process.stderr.write(`${formatHelp(optsForHelp, commands)}\n`);
        return;
      }

      const target = commands.find((c) => c.name === cmd);
      if (!target) {
        process.stderr.write(
          `未知命令: ${cmd}\n\n${formatHelp(optsForHelp, commands)}\n`,
        );
        process.exitCode = 1;
        return;
      }

      // 子命令级 --help
      if (wantHelp) {
        process.stderr.write(
          `${formatCommandHelp(optsForHelp, target, commonArgs)}\n`,
        );
        return;
      }

      try {
        const merged = mergeSchema(commonArgs, target.args);
        const resolved = resolveArgs({ ...target, args: merged }, opts);
        await target.handler(resolved as never, opts);
      } catch (err) {
        handleCliError(err);
      }
    },
  };
  return router;
}

function mergeSchema(
  base: ArgsSchema,
  override: ArgsSchema | undefined,
): ArgsSchema {
  if (!override) return { ...base };
  return { ...base, ...override };
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
    out[key] = coerce(key, raw, def);
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
    case "json":
      return undefined;
  }
}

function coerce(
  key: string,
  raw: string | boolean | string[],
  def: ArgSpec,
): unknown {
  switch (def.type) {
    case "string": {
      let value: string;
      if (typeof raw === "string") value = raw;
      else if (Array.isArray(raw)) value = raw[raw.length - 1] ?? "";
      else throw new UserInputError(`参数 --${key} 必须是字符串`);
      if (def.choices && !def.choices.includes(value)) {
        throw new UserInputError(
          `参数 --${key} 非法，可选值：${def.choices.join("/")}，收到 "${value}"`,
        );
      }
      return value;
    }
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
    case "json": {
      if (typeof raw !== "string") {
        throw new UserInputError(
          `参数 --${key} 必须是 JSON 字符串，收到: ${String(raw)}`,
        );
      }
      try {
        return JSON.parse(raw);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new UserInputError(`参数 --${key} 不是合法 JSON：${msg}`);
      }
    }
  }
}

function formatHelp(
  opts: RouterOptions<ArgsSchema>,
  commands: CommandSpec<ArgsSchema>[],
): string {
  const lines: string[] = [];
  lines.push(`${opts.name} — ${opts.description ?? ""}`.trim());
  lines.push("");
  lines.push("用法：");
  lines.push(`  node scripts/main.mjs <command> [options]`);
  lines.push("");
  lines.push("命令：");
  for (const c of commands) {
    lines.push(`  ${c.name.padEnd(16)} ${c.description}`);
  }
  lines.push("");
  lines.push("公共参数：");
  for (const [k, def] of Object.entries(opts.commonArgs ?? {})) {
    lines.push(`  ${formatArgRow(k, def)}`);
  }
  lines.push("  --help, -h        查看帮助");
  if (commands.length > 0) {
    lines.push("");
    lines.push(
      `提示：使用 \`node scripts/main.mjs <command> --help\` 查看具体子命令的参数。`,
    );
  }
  return lines.join("\n");
}

function formatCommandHelp(
  _opts: RouterOptions<ArgsSchema>,
  cmd: CommandSpec<ArgsSchema>,
  commonArgs: ArgsSchema,
): string {
  const lines: string[] = [];
  lines.push(`${_opts.name} ${cmd.name} — ${cmd.description}`);
  lines.push("");
  lines.push("用法：");
  lines.push(`  node scripts/main.mjs ${cmd.name} [options]`);
  lines.push("");
  lines.push("参数：");
  const merged = mergeSchema(commonArgs, cmd.args);
  if (Object.keys(merged).length === 0) {
    lines.push("  （无）");
  } else {
    for (const [k, def] of Object.entries(merged)) {
      lines.push(`  ${formatArgRow(k, def)}`);
    }
  }
  return lines.join("\n");
}

function formatArgRow(name: string, def: ArgSpec): string {
  const flag = `--${name}`;
  const tag = def.required ? "必填" : "可选";
  const choices = def.choices ? `（${def.choices.join("/")}）` : "";
  return `${flag.padEnd(16)} <${def.type}> [${tag}] ${def.desc ?? ""}${choices}`;
}
