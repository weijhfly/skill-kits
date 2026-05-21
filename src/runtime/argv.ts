/**
 * 轻量但完备的 argv 解析（零依赖，runtime 内部使用）。
 *
 * 仅供 `command.ts` 的 `createRouter` 内部调用，**不**作为公共 API 导出。
 * 用户通过 `createRouter({ args: { ... } })` 的 schema 拿到 type-safe 的参数对象，
 * 不应直接消费 `parseArgv` 的原生返回值。
 *
 * 支持：
 * - `--key value`   长选项 + 值
 * - `--key=value`   长选项 = 值（Agent 高频生成的写法）
 * - `--flag`        布尔旗标（true）
 * - `--no-flag`     布尔旗标（false）
 * - `-k value`      短选项 + 值
 * - `-k=value`      短选项 = 值
 * - `-abc`          短旗标聚合（等价 `-a -b -c`，全部置 true）
 * - 重复 key 自动合并为字符串数组（如 `--tag a --tag b` => `["a", "b"]`）
 * - 自动去除值两侧成对的引号
 * - `--`            之后的所有 token 全部计入 `_`，不再解析
 */

export interface ParsedArgv {
  _: string[];
  [key: string]: string | boolean | string[];
}

function sanitize(val: string): string {
  if (!val) return val;
  let res = val.trim();
  if (
    (res.startsWith("'") && res.endsWith("'")) ||
    (res.startsWith('"') && res.endsWith('"'))
  ) {
    res = res.slice(1, -1);
  }
  return res.trim();
}

function assign(args: ParsedArgv, key: string, value: string | boolean): void {
  const prev = args[key];
  if (prev === undefined) {
    args[key] = value;
    return;
  }
  if (typeof value === "string") {
    if (Array.isArray(prev)) {
      prev.push(value);
    } else if (typeof prev === "string") {
      args[key] = [prev, value];
    } else {
      args[key] = value;
    }
  } else {
    args[key] = value;
  }
}

export function parseArgv(argv: string[]): ParsedArgv {
  const args: ParsedArgv = { _: [] };
  let i = 0;
  let positionalOnly = false;

  while (i < argv.length) {
    const cur = argv[i];
    if (cur === undefined) {
      i += 1;
      continue;
    }

    if (positionalOnly) {
      args._.push(cur);
      i += 1;
      continue;
    }

    if (cur === "--") {
      positionalOnly = true;
      i += 1;
      continue;
    }

    if (cur.startsWith("--")) {
      const body = cur.slice(2);
      const eqIdx = body.indexOf("=");
      if (eqIdx >= 0) {
        const key = body.slice(0, eqIdx);
        const val = sanitize(body.slice(eqIdx + 1));
        assign(args, key, val);
        i += 1;
        continue;
      }
      if (body.startsWith("no-")) {
        assign(args, body.slice(3), false);
        i += 1;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        assign(args, body, sanitize(next));
        i += 2;
        continue;
      }
      assign(args, body, true);
      i += 1;
      continue;
    }

    if (cur.startsWith("-") && cur.length > 1) {
      const body = cur.slice(1);
      const eqIdx = body.indexOf("=");
      if (eqIdx >= 0) {
        const key = body.slice(0, eqIdx);
        const val = sanitize(body.slice(eqIdx + 1));
        assign(args, key, val);
        i += 1;
        continue;
      }
      if (body.length > 1) {
        for (const ch of body) assign(args, ch, true);
        i += 1;
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        assign(args, body, sanitize(next));
        i += 2;
        continue;
      }
      assign(args, body, true);
      i += 1;
      continue;
    }

    args._.push(cur);
    i += 1;
  }

  return args;
}
