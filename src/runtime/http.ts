/**
 * 轻量 HTTP 封装，零依赖，基于全局 `fetch`（Node 18+）。
 *
 * 设计原则：
 * - **不抛错**：网络异常 / 非 2xx 都通过 `HttpResponse.ok` 表达，业务自己决定如何处理
 * - **JSON 优先**：自动 `JSON.parse` 响应体；解析失败回退到 `text`，不丢信息
 * - **不内置鉴权**：Cookie / Bearer / 自定义头由调用方通过 `headers` 传入
 * - **范围有意小**：仅 `get` / `post` / `request`，不做拦截器、重试、baseURL 之类
 *
 * 业务封装思路：上层自己包一层 `apiGet/apiPost`，
 * 在里面注入域名、鉴权、错误码映射，runtime 只解决"少写点 fetch 样板"。
 *
 * 使用：
 *   import { httpGet, httpPost } from "skill-kits/runtime";
 *
 *   const res = await httpGet<UserInfo>("https://api.example.com/me", {
 *     headers: { authorization: `Bearer ${token}` },
 *     query: { fields: "id,name" },
 *     timeoutMs: 10_000,
 *   });
 *   if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
 *   console.log(res.data?.name);
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export type QueryValue = string | number | boolean | null | undefined;

export interface HttpRequestOptions {
  /** 自定义请求头，会与默认头浅合并。 */
  headers?: Record<string, string>;
  /**
   * URL query 参数，会被附加到 url 上。
   * - `undefined` / `null` / `""` 自动跳过，便于直接传选项对象
   * - 数组未支持，需要重复 key 请用 `URLSearchParams` 自行拼装
   */
  query?: Record<string, QueryValue>;
  /**
   * 请求体：
   * - 对象 / 数组 → 自动 `JSON.stringify` 并设置 `content-type: application/json`
   * - 字符串 / Buffer / FormData / URLSearchParams → 原样透传，不动 content-type
   * - `undefined` → 不带 body
   */
  body?: unknown;
  /** 透传 fetch signal，便于外部 AbortController 取消。 */
  signal?: AbortSignal;
  /**
   * 软超时，单位毫秒。内部用 AbortController 实现，超时后 `ok=false, status=0`。
   * 若同时传入 `signal`，两者任一触发即取消。
   */
  timeoutMs?: number;
  /** fetch redirect 策略，默认 `follow`。需要读 302 Location 时设为 `manual`。 */
  redirect?: "follow" | "manual" | "error";
}

export interface HttpResponse<T> {
  /** HTTP 状态码在 200-299，且未发生网络错误。 */
  ok: boolean;
  /** HTTP 状态码；网络异常 / 超时为 0。 */
  status: number;
  /** HTTP statusText；网络异常时填 `NetworkError: <message>` 或 `Timeout`。 */
  statusText: string;
  /** 响应头；网络异常时是空 Headers 对象。 */
  headers: Headers;
  /** 解析后的响应体（JSON 解析成功时为对象，否则为 null）。 */
  data: T | null;
  /** 原始响应文本，便于排查或在 JSON 解析失败时降级使用。 */
  text: string;
}

/**
 * 通用请求入口。`get` / `post` 都是它的薄封装。
 */
export async function httpRequest<T = unknown>(
  method: HttpMethod,
  url: string,
  options: HttpRequestOptions = {},
): Promise<HttpResponse<T>> {
  const finalUrl = appendQuery(url, options.query);
  const { headers, body } = buildBody(options.headers, options.body);

  const ac = new AbortController();
  const timer =
    options.timeoutMs && options.timeoutMs > 0
      ? setTimeout(() => ac.abort(new Error("Timeout")), options.timeoutMs)
      : undefined;
  const externalAbort = () => ac.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) externalAbort();
    else
      options.signal.addEventListener("abort", externalAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(finalUrl, {
      method,
      headers,
      body,
      signal: ac.signal,
      redirect: options.redirect ?? "follow",
    });
  } catch (error) {
    const isTimeout =
      ac.signal.aborted && options.timeoutMs && !options.signal?.aborted;
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      statusText: isTimeout ? "Timeout" : `NetworkError: ${message}`,
      headers: new Headers(),
      data: null,
      text: "",
    };
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", externalAbort);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: data as T | null,
    text,
  };
}

export function httpGet<T = unknown>(
  url: string,
  options?: Omit<HttpRequestOptions, "body">,
): Promise<HttpResponse<T>> {
  return httpRequest<T>("GET", url, options);
}

export function httpPost<T = unknown>(
  url: string,
  body?: unknown,
  options?: Omit<HttpRequestOptions, "body">,
): Promise<HttpResponse<T>> {
  return httpRequest<T>("POST", url, { ...options, body });
}

function appendQuery(url: string, query: HttpRequestOptions["query"]): string {
  if (!query) return url;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  if (!qs) return url;
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}

type FetchBody = NonNullable<Parameters<typeof fetch>[1]>["body"];

function buildBody(
  customHeaders: Record<string, string> | undefined,
  body: unknown,
): { headers: Record<string, string>; body: FetchBody | undefined } {
  const headers: Record<string, string> = { ...(customHeaders ?? {}) };
  if (body === undefined || body === null) {
    return { headers, body: undefined };
  }
  if (
    typeof body === "string" ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    isFormData(body)
  ) {
    return { headers, body: body as FetchBody };
  }
  // 对象 / 数组 / 数字 / 布尔 → JSON
  if (!hasHeader(headers, "content-type")) {
    headers["content-type"] = "application/json";
  }
  return { headers, body: JSON.stringify(body) };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === target);
}

function isFormData(value: unknown): boolean {
  return typeof FormData !== "undefined" && value instanceof FormData;
}
