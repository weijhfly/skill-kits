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
