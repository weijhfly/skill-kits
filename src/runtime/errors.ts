/**
 * Skill 错误协议（精简版）。
 *
 * 设计原则：runtime 仅提供"基类 + 三个最高频子类"，业务可继承 `SkillError`
 * 自定义任意 code（如 `RATE_LIMIT` / `TIMEOUT` / `CONFLICT` …），由宿主据 code 匹配文案。
 *
 * 内置错误码：
 *   - USER_INPUT_ERROR  用户输入校验失败
 *   - AUTH_ERROR        鉴权失败 / Token 过期
 *   - HTTP_ERROR        上游 HTTP 调用失败
 *
 * 业务自定义示例：
 *   class RateLimitError extends SkillError {
 *     constructor(msg: string, public retryAfterSec?: number) {
 *       super("RATE_LIMIT", msg);
 *     }
 *   }
 */
export class SkillError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "SkillError";
    this.code = code;
    this.details = details;
  }
}

/** 用户输入校验失败。 */
export class UserInputError extends SkillError {
  constructor(message: string, details?: unknown) {
    super("USER_INPUT_ERROR", message, details);
    this.name = "UserInputError";
  }
}

/** 鉴权失败 / Token 过期（401/403）。 */
export class AuthError extends SkillError {
  constructor(message: string, details?: unknown) {
    super("AUTH_ERROR", message, details);
    this.name = "AuthError";
  }
}

/** 上游 HTTP 调用失败。 */
export class HttpError extends SkillError {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string, message: string, details?: unknown) {
    super("HTTP_ERROR", message, details);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

export interface BusinessApiErrorOptions {
  /** SkillError.code，缺省按 bizCode 自动派生：`BIZ_<bizCode>` 或保留字符串。 */
  errorCode?: string;
  /** 业务错误码 → 文案的提示表，命中时会拼到 message 里。 */
  hintMap?: Record<string | number, string>;
  /** 任意附加排查上下文。 */
  details?: unknown;
}

/**
 * HTTP 200 但「业务 code != 0」的统一错误：
 * - 输出格式：`[code=<bizCode>] <message>（<hint>）`
 * - SkillError.code 默认派生自 bizCode（数字 → `BIZ_<n>`，字符串 → 原样）
 *
 * 业务通常在自己的 `apiGet/apiPost` 里 throw 一下，让 LLM 看到一致的错误格式。
 */
export class BusinessApiError extends SkillError {
  readonly bizCode: number | string;

  constructor(
    bizCode: number | string,
    message: string,
    options: BusinessApiErrorOptions = {},
  ) {
    const hint = options.hintMap?.[bizCode] ?? "";
    const composed = hint
      ? `[code=${bizCode}] ${message}（${hint}）`
      : `[code=${bizCode}] ${message}`;
    super(
      options.errorCode ?? deriveBusinessCode(bizCode),
      composed,
      options.details,
    );
    this.name = "BusinessApiError";
    this.bizCode = bizCode;
  }
}

function deriveBusinessCode(bizCode: number | string): string {
  if (typeof bizCode === "number") return `BIZ_${bizCode}`;
  return bizCode;
}
