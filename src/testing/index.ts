/**
 * Skill 单测辅助库（`skill-kits/testing`）。
 *
 * 业务 Skill 的逻辑大多有两类外部副作用，自己搭测试环境很啰嗦：
 * - HTTP：经 runtime 的 httpRequest 走全局 fetch
 * - 输出：writeResult/writeError/notify 写 stdout/stderr，并改 process.exitCode
 *
 * 这两件「脏活」收口到这里，让业务测试几乎零样板，配合 node:test 直接断言：
 *
 *   import { test } from "node:test";
 *   import assert from "node:assert/strict";
 *   import { mockFetch, captureOutput } from "skill-kits/testing";
 *
 *   test("xxx", async () => {
 *     const mock = mockFetch([{ match: /\/repositories/, json: { code: 0, data: [] } }]);
 *     const { json, exitCode } = await captureOutput(() => runCommand());
 *     assert.equal(exitCode, 0);
 *     mock.restore();
 *   });
 */

export interface MockRoute {
  /**
   * 匹配请求 URL：
   * - string：子串包含匹配
   * - RegExp：正则匹配
   * - 函数：自定义判断，可读 url 与 init
   */
  match: string | RegExp | ((url: string, init?: RequestInit) => boolean);
  /** 便捷写法：直接给 JSON body，自动包成 `Response`（默认 200）。 */
  json?: unknown;
  /** 便捷写法：直接给文本 body。 */
  text?: string;
  /** HTTP 状态码，默认 200。 */
  status?: number;
  /** 自定义响应头。 */
  headers?: Record<string, string>;
  /** 完全自定义响应（优先级最高，忽略 json/text/status/headers）。 */
  response?: (url: string, init?: RequestInit) => Response | Promise<Response>;
}

export interface MockFetchHandle {
  /** 还原被替换的全局 fetch。 */
  restore: () => void;
  /** 已捕获的请求记录，按调用顺序。 */
  readonly calls: { url: string; init?: RequestInit }[];
}

function buildResponse(route: MockRoute, url: string, init?: RequestInit) {
  if (route.response) return route.response(url, init);
  const status = route.status ?? 200;
  const headers = { ...(route.headers ?? {}) };
  let body: string;
  if (route.text !== undefined) {
    body = route.text;
  } else if (route.json !== undefined) {
    body = JSON.stringify(route.json);
    if (!hasHeader(headers, "content-type")) {
      headers["content-type"] = "application/json";
    }
  } else {
    body = "";
  }
  return new Response(body, { status, headers });
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === target);
}

function matches(route: MockRoute, url: string, init?: RequestInit): boolean {
  const { match } = route;
  if (typeof match === "string") return url.includes(match);
  if (match instanceof RegExp) return match.test(url);
  return match(url, init);
}

/**
 * 替换全局 `fetch`，按 routes 顺序匹配返回假响应。
 *
 * - 命中第一个匹配的 route；未命中抛错（避免测试里漏配某个接口被静默放过）
 * - 通过 `restore()` 还原；建议在测试末尾或 afterEach 调用
 */
export function mockFetch(routes: MockRoute[]): MockFetchHandle {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];

  const fakeFetch = (async (
    input: string | URL | { url: string },
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });
    const route = routes.find((r) => matches(r, url, init));
    if (!route) {
      throw new Error(`[mockFetch] 未匹配到任何 route 的请求: ${url}`);
    }
    return buildResponse(route, url, init);
  }) as typeof fetch;

  globalThis.fetch = fakeFetch;

  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

export interface CaptureResult {
  /** writeResult 写入 stdout 的原始文本。 */
  stdout: string;
  /** writeError / notify 写入 stderr 的原始文本。 */
  stderr: string;
  /** 自动 JSON.parse(stdout)；解析失败为 undefined。 */
  json: unknown;
  /** 运行结束时的 process.exitCode（成功命令为 0）。 */
  exitCode: number;
}

/**
 * 捕获 `fn` 执行期间写入 stdout/stderr 的内容与 process.exitCode。
 *
 * 用于测试命令出口（writeResult/writeError）。会临时接管 process.stdout/stderr
 * 的 write，并在结束后无条件还原（即使 fn 抛错也还原）。
 */
export async function captureOutput(
  fn: () => Promise<void> | void,
): Promise<CaptureResult> {
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const prevExitCode = process.exitCode;

  let stdout = "";
  let stderr = "";
  process.exitCode = 0;

  process.stdout.write = ((chunk: unknown): boolean => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown): boolean => {
    stderr += String(chunk);
    return true;
  }) as typeof process.stderr.write;

  try {
    await fn();
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }

  const exitCode = typeof process.exitCode === "number" ? process.exitCode : 0;
  process.exitCode = prevExitCode;

  let json: unknown;
  try {
    json = stdout ? JSON.parse(stdout) : undefined;
  } catch {
    json = undefined;
  }

  return { stdout, stderr, json, exitCode };
}
