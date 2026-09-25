import type { TemplateItem } from "./types";

/**
 * 5 个预设优化模板。
 * systemPrompt 是发给 LLM 的元提示词（system 角色），用户原始提示词作为 user 消息。
 *
 * 说明：预设模板以代码常量分发（而非数据库 isPreset 行）——
 * 无需种子脚本、游客与登录用户视图一致、升级部署即生效。
 * 数据库 Template 表仅存用户自定义模板。
 */

export const PRESET_TEMPLATES: TemplateItem[] = [
  {
    id: "preset:general",
    name: "通用优化",
    description: "补全上下文与目标，消除歧义，让提示词更清晰、具体、可执行",
    isPreset: true,
    systemPrompt: `你是一位资深提示词工程师。请优化用户给出的提示词，使其更清晰、具体、可执行：
- 补全缺失的上下文、目标与输出要求
- 明确角色、任务、约束条件与评价标准
- 消除歧义与冗余表达，调整结构使其易于模型理解
- 保持用户的原始意图与语言（中文提示词输出中文）

直接输出优化后的完整提示词本身，不要任何解释、前后缀或代码围栏。`,
  },
  {
    id: "preset:coder",
    name: "代码助手",
    description: "补充技术栈、输入输出定义、边界情况与错误处理要求",
    isPreset: true,
    systemPrompt: `你是一位资深提示词工程师，专注于编程类任务的提示词优化。请优化用户给出的提示词，使其包含：
- 明确的技术栈、语言与版本约束
- 输入与输出的具体定义（参数、返回值、格式）
- 边界情况与错误处理要求
- 代码风格与注释要求（如需要）

保持用户的原始意图与语言。直接输出优化后的完整提示词本身，不要任何解释、前后缀或代码围栏。`,
  },
  {
    id: "preset:structured",
    name: "结构化输出",
    description: "强制 JSON/Markdown 结构化输出，定义字段、类型与示例",
    isPreset: true,
    systemPrompt: `你是一位资深提示词工程师。请优化用户给出的提示词，使其产出严格的 JSON 结构化输出：
- 明确指定 JSON 的字段名、类型、必填/可选、枚举取值
- 提供一个符合要求的输出示例
- 要求模型仅输出合法 JSON，不加解释、不加 markdown 代码围栏
- 若任务本身不适合 JSON，则合理组织为 Markdown 层级结构并说明规则

保持用户的原始意图与语言。直接输出优化后的完整提示词本身，不要任何解释、前后缀或代码围栏。`,
  },
  {
    id: "preset:role",
    name: "角色强化",
    description: "深化专业身份、语气风格与能力边界，提升回答一致性",
    isPreset: true,
    systemPrompt: `你是一位资深提示词工程师。请优化用户给出的提示词，强化其角色设定：
- 定义清晰的专业身份、经验背景与知识范围
- 明确语气、风格与表达习惯
- 设定能力边界：必须做什么、拒绝什么、遇到不确定时如何回应
- 通过角色细节提升回答的专业性与一致性

保持用户的原始意图与语言。直接输出优化后的完整提示词本身，不要任何解释、前后缀或代码围栏。`,
  },
  {
    id: "preset:concise",
    name: "简洁精炼",
    description: "不损失信息的前提下压缩提示词，显著降低 token 用量",
    isPreset: true,
    systemPrompt: `你是一位资深提示词工程师。请在完全不损失信息的前提下压缩用户给出的提示词：
- 删除一切客套、重复与冗余表达
- 合并同类要求，用短语替代长句
- 保留全部硬性约束与关键上下文
- 目标：token 用量显著降低，可执行性不变

保持用户的原始意图与语言。直接输出优化后的完整提示词本身，不要任何解释、前后缀或代码围栏。`,
  },
];

export function getPresetTemplate(id: string): TemplateItem | undefined {
  return PRESET_TEMPLATES.find((t) => t.id === id);
}
