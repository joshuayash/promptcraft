// 协议类型：决定用哪个 SDK 工厂 / 端点格式
export type Protocol = "openai" | "anthropic" | "gemini";

// 前端展示用的 API Key 配置（脱敏视图，已登录模式）
export interface ApiKeyView {
  id: string;
  label: string;
  provider: string; // 内置厂商 id 或 "custom"
  protocol: Protocol;
  baseUrl?: string | null;
  maskedKey: string;
  createdAt: string;
}

// 游客模式的本地 Key 配置（localStorage 明文存储，用户自担风险）
export interface LocalApiKey {
  id: string;
  label: string;
  provider: string;
  protocol: Protocol;
  baseUrl?: string;
  apiKey: string;
}

// 模板（预设 + 自定义统一形状）
export interface TemplateItem {
  id: string; // 预设为 "preset:<key>"，自定义为数据库/localStorage id
  name: string;
  description: string;
  systemPrompt: string;
  isPreset: boolean;
}

// 历史记录
export interface HistoryEntry {
  id: string;
  originalPrompt: string;
  optimizedPrompt: string;
  templateId?: string | null;
  templateName: string;
  provider: string; // 展示名（厂商名或自定义标签）
  model: string;
  createdAt: string; // ISO
}

// 后端统一错误格式 { error: { code, message } }
export interface ApiErrorBody {
  error: { code: string; message: string };
}
