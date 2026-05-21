/**
 * stdout / stderr 严格分离的日志：
 * - stdout：`writeResult` —— 最终结构化 JSON，供 Agent 消费
 * - stderr：`writeError` / `notify` —— 错误与进度提示，不污染 stdout
 *
 * 设计要点：
 * - `writeError` 自动识别 SkillError 子类的 code / details，落到结构化 JSON 中
 * - `handleCliError` 顶层 catch 兜底，未知错误统一格式化
 */

import { SkillError } from "./errors.js";

export type Jsonish = unknown;

/** 输出结构化结果到 stdout。Agent 通常只解析 stdout 的最后一行 JSON。
 *
 * 泛型 `T` 仅用于在 TS 调用点约束 payload 形状，不影响运行时行为；
 * 不传时与传 `unknown`/`Jsonish` 等价，保持向后兼容。
 */
export function writeResult<T extends Jsonish = Jsonish>(
  payload: T,
  pretty = false,
): void {
  const text = JSON.stringify(payload, null, pretty ? 2 : 0);
  process.stdout.write(`${text}\n`);
}

export interface WriteErrorOptions {
  /** 错误码，缺省 `UNKNOWN_ERROR`。SkillError 子类会自动注入。 */
  code?: string;
  /** 任意附加上下文。 */
  extra?: Record<string, unknown>;
  /** 是否设置 process.exitCode = 1，默认 true。 */
  setExitCode?: boolean;
}

/**
 * 输出错误到 stderr，并把进程退出码置 1（不立即退出，调用方可继续清理）。
 *
 * 重载：
 * - writeError(error)                  // 直接传入 Error / SkillError
 * - writeError(message)                // 传入字符串
 * - writeError(message, { code, extra })
 */
export function writeError(
  errorOrMessage: unknown,
  options: WriteErrorOptions = {},
): void {
  let message: string;
  let code = options.code ?? "UNKNOWN_ERROR";
  let details: unknown;

  if (errorOrMessage instanceof SkillError) {
    message = errorOrMessage.message;
    code = options.code ?? errorOrMessage.code;
    details = errorOrMessage.details;
  } else if (errorOrMessage instanceof Error) {
    message = errorOrMessage.message;
  } else {
    message = String(errorOrMessage);
  }

  const payload: Record<string, unknown> = {
    ok: false,
    code,
    error: message,
  };
  if (details !== undefined) payload.details = details;
  if (options.extra) Object.assign(payload, options.extra);

  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (options.setExitCode !== false) process.exitCode = 1;
}

/** 进度/阶段提示，写入 stderr。带 ℹ️ 前缀，便于宿主消息渲染识别。 */
export function notify(message: string): void {
  process.stderr.write(`ℹ️  ${message}\n`);
}

/** 在顶层 catch 中统一处理未知错误。SkillError 子类会自动落 code/details。 */
export function handleCliError(error: unknown): void {
  if (error instanceof SkillError) {
    writeError(error);
    return;
  }
  if (error instanceof Error) {
    writeError(error.message, {
      extra: error.stack ? { stack: error.stack } : undefined,
    });
    return;
  }
  writeError(String(error));
}
