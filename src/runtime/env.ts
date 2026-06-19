/**
 * 环境变量读取统一封装。
 *
 * 设计要点：
 * - **缺失即抛错**：`requireEnv` 在缺失/空白时抛 `UserInputError`，自动统一文案
 * - **可选回填**：`optionalEnv` 返回 `string | null`，方便业务做兜底逻辑
 * - **附 hint**：抛错时可附「申请地址 / 配置说明」，避免每个 Skill 重写错误信息
 *
 * 使用：
 *   const token = requireEnv("OPENAPI_TOKEN", {
 *     hint: "申请地址：https://example.com/get-token",
 *   });
 *
 *   const pat = optionalEnv("FIGMA_PERSONAL_ACCESS_TOKEN");
 */
import { UserInputError } from "./errors.js";

export interface RequireEnvOptions {
  /** 缺失时附加的提示，例如申请地址或配置说明。 */
  hint?: string;
}

/** 读取必填环境变量，缺失或空白时抛 `UserInputError`（code=`USER_INPUT_ERROR`）。 */
export function requireEnv(
  name: string,
  options: RequireEnvOptions = {},
): string {
  const raw = process.env[name];
  const value = raw === undefined ? "" : raw.trim();
  if (!value) {
    const hint = options.hint ? `. ${options.hint}` : "";
    throw new UserInputError(`Missing environment variable ${name}${hint}`, {
      env: name,
    });
  }
  return value;
}

/** 读取可选环境变量；空白或未设置时返回 `null`。 */
export function optionalEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}
