import type { Protocol } from "./types";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { resolveBaseUrl } from "./providers";

/**
 * 按协议创建 AI SDK 语言模型实例。
 * baseUrl 为空时使用各 SDK 的官方默认端点。
 */
export function createLanguageModel(cfg: {
  protocol: Protocol;
  providerId: string; // 内置 id 或 "custom"（用于解析默认 baseUrl）
  baseUrl?: string | null;
  apiKey: string;
  model: string;
}): LanguageModel {
  const baseURL = resolveBaseUrl(cfg.providerId, cfg.baseUrl);

  switch (cfg.protocol) {
    case "anthropic":
      return createAnthropic({ apiKey: cfg.apiKey, baseURL })(cfg.model);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey: cfg.apiKey, baseURL })(cfg.model);
    case "moonshot":
      // Moonshot AI 使用 OpenAI 兼容协议，但保留独立协议标识以便未来扩展
      return createOpenAI({ apiKey: cfg.apiKey, baseURL })(cfg.model);
    case "openai":
    default:
      return createOpenAI({ apiKey: cfg.apiKey, baseURL })(cfg.model);
  }
}
