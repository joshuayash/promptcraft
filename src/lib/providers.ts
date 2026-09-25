import type { Protocol } from "./types";

// 内置厂商定义（provider id → 展示名、协议、默认端点、预设模型列表）
export interface ProviderDef {
  id: string;
  name: string;
  protocol: Protocol;
  baseUrl?: string; // 未填 = SDK 默认官方端点
  models: string[]; // 预设模型列表（可手动输入覆盖）
  keyHint: string; // 申请地址提示
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI",
    protocol: "openai",
    models: ["gpt-5.2", "gpt-5.2-mini", "gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    keyHint: "platform.openai.com",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    protocol: "anthropic",
    models: ["claude-sonnet-4-6", "claude-opus-4-2", "claude-haiku-4-2", "claude-3-7-sonnet-latest"],
    keyHint: "console.anthropic.com",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    protocol: "openai",
    baseUrl: "https://api.x.ai/v1",
    models: ["grok-4", "grok-4-fast", "grok-3-mini"],
    keyHint: "console.x.ai",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    protocol: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "platform.deepseek.com",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    protocol: "moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2-0905-preview", "kimi-k2-turbo-preview", "moonshot-v1-128k"],
    keyHint: "platform.moonshot.cn",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    protocol: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4.7", "glm-4.6", "glm-4.5-air", "glm-4-flash"],
    keyHint: "open.bigmodel.cn",
  },
  {
    id: "qwen",
    name: "通义千问",
    protocol: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen3-max", "qwen3-plus", "qwen-turbo", "qwen3-coder-plus"],
    keyHint: "dashscope.console.aliyun.com",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    protocol: "gemini",
    models: ["gemini-3-pro", "gemini-3-flash", "gemini-2.5-pro", "gemini-2.5-flash"],
    keyHint: "aistudio.google.com",
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

// 各协议官方默认端点（SDK 未显式传 baseUrl 时的兑底，用于 /v1/models 拉取）
export const DEFAULT_BASE_URLS: Record<Protocol, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com",
  moonshot: "https://api.moonshot.cn/v1",
};

// 端点必须显式声明（覆盖内置或自定义），SDK 默认不传
export function resolveBaseUrl(providerId: string, customBaseUrl?: string | null): string | undefined {
  if (customBaseUrl && customBaseUrl.trim()) return customBaseUrl.trim();
  const p = getProvider(providerId);
  return p?.baseUrl; // 官方端点的厂商返回 undefined → SDK 用默认
}
