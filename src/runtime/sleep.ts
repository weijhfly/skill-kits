/**
 * 长轮询心跳：把一次 sleep 切成多段，每段结束往 stderr 写一次进度，
 * 防止 Agent 误判 idle 杀进程，也避免轮询期间无任何输出。
 *
 * 设计要点：
 * - 默认每 5 秒一次心跳（与项目约定一致）
 * - `message` 支持函数形式，便于动态生成「剩余 Ns」「已尝试 X 轮」等文案
 * - 默认通过 `notify()` 输出到 stderr，可通过 `onBeat` 自定义
 *
 * 使用：
 *   await sleepWithHeartbeat(60_000, {
 *     message: (rem) => `等待生码... 剩余 ${rem}s`,
 *   });
 */
import { notify } from "./logger.js";

const DEFAULT_HEARTBEAT_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface SleepWithHeartbeatOptions {
  /** 心跳间隔，默认 5000ms。 */
  intervalMs?: number;
  /**
   * 心跳消息或工厂函数；函数形参为剩余秒数。
   * 默认输出 `等待中... 剩余 ${remaining}s`。
   */
  message?: string | ((remainingSeconds: number) => string);
}

/**
 * 等待 `totalMs` 毫秒，期间按 `intervalMs` 间隔输出心跳。
 *
 * - 若 `totalMs <= 0` 立即返回
 * - 最后一段不足 `intervalMs` 时不会再发心跳，直接返回
 */
export async function sleepWithHeartbeat(
  totalMs: number,
  options: SleepWithHeartbeatOptions = {},
): Promise<void> {
  if (totalMs <= 0) return;
  const intervalMs = options.intervalMs ?? DEFAULT_HEARTBEAT_MS;
  const onBeat = defaultOnBeat(options.message);

  const endAt = Date.now() + totalMs;
  while (Date.now() < endAt) {
    const waitMs = Math.min(intervalMs, endAt - Date.now());
    await sleep(waitMs);
    if (Date.now() >= endAt) break;
    onBeat(Math.ceil((endAt - Date.now()) / 1000));
  }
}

function defaultOnBeat(
  message: SleepWithHeartbeatOptions["message"],
): (remaining: number) => void {
  return (remaining) => {
    if (typeof message === "function") {
      notify(message(remaining));
      return;
    }
    notify(message ?? `等待中... 剩余 ${remaining}s`);
  };
}
