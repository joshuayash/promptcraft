import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { createLanguageModel } from "@/lib/ai-model";
import { getPresetTemplate } from "@/lib/preset-templates";
import { streamText } from "ai";
import type { LanguageModel } from "ai";
import type { Protocol } from "@/lib/types";

interface OptimizeInput {
  prompt: string;
  templateId: string;
  keyId: string;
  model: string;
  saveHistory: boolean;
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function parseBody(req: Request): Promise<OptimizeInput | NextResponse> {
  let raw: { prompt?: string; templateId?: string; keyId?: string; model?: string; saveHistory?: boolean } | null = null;
  try {
    raw = await req.json();
  } catch {
    raw = null;
  }
  const prompt = String(raw?.prompt ?? "").trim();
  const templateId = String(raw?.templateId ?? "");
  const keyId = String(raw?.keyId ?? "");
  const model = String(raw?.model ?? "").trim();
  const saveHistory = raw?.saveHistory !== false; // 默认保存

  if (!prompt) return jsonError("EMPTY_PROMPT", "请输入要优化的提示词", 400);
  if (!templateId) return jsonError("MISSING_TEMPLATE", "请选择优化模板", 400);
  if (!keyId) return jsonError("MISSING_KEY", "请选择 API Key 配置", 400);
  if (!model) return jsonError("MISSING_MODEL", "请选择或填写模型名称", 400);
  return { prompt, templateId, keyId, model, saveHistory };
}

async function resolveSystemPrompt(
  userId: string,
  templateId: string,
): Promise<{ systemPrompt: string; templateDbId: string | null } | NextResponse> {
  if (templateId.startsWith("preset:")) {
    const preset = getPresetTemplate(templateId);
    if (!preset) return jsonError("UNKNOWN_TEMPLATE", "未找到该模板", 400);
    return { systemPrompt: preset.systemPrompt, templateDbId: null };
  }
  const tpl = await prisma.template.findFirst({
    where: { id: templateId, userId },
  });
  if (!tpl) return jsonError("UNKNOWN_TEMPLATE", "未找到该模板", 400);
  return { systemPrompt: tpl.systemPrompt, templateDbId: tpl.id };
}

async function resolveModel(
  userId: string,
  keyId: string,
  model: string,
): Promise<{ model: LanguageModel; providerLabel: string } | NextResponse> {
  const keyRow = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  });
  if (!keyRow) return jsonError("UNKNOWN_KEY", "未找到该 API Key 配置", 400);

  let apiKey: string;
  try {
    apiKey = decryptSecret(keyRow.apiKeyEnc);
  } catch {
    return jsonError(
      "DECRYPT_FAILED",
      "API Key 解密失败，请删除后重新添加（ENCRYPTION_KEY 可能已更换）",
      500,
    );
  }

  const languageModel = createLanguageModel({
    protocol: keyRow.protocol as Protocol,
    providerId: keyRow.provider,
    baseUrl: keyRow.baseUrl,
    apiKey,
    model,
  });
  return { model: languageModel, providerLabel: keyRow.label };
}

async function saveHistoryAsync(
  userId: string,
  input: OptimizeInput,
  templateDbId: string | null,
  providerLabel: string,
  result: { text: PromiseLike<string> },
): Promise<void> {
  try {
    const optimized = await result.text;
    if (!optimized.trim()) return;
    await prisma.optimizationHistory.create({
      data: {
        userId,
        originalPrompt: input.prompt,
        optimizedPrompt: optimized,
        templateId: templateDbId,
        provider: providerLabel,
        model: input.model,
      },
    });
  } catch {
    // 历史保存失败不影响主流程
  }
}

/**
 * 核心优化接口（仅登录用户——服务端代理模式）。
 * 流式返回纯文本流（AI SDK textStream）。
 * 游客模式由前端直连厂商端点，不走本接口（见 8.1）。
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("UNAUTHORIZED", "请先登录后再使用服务端优化", 401);
  }

  const input = await parseBody(req);
  if (input instanceof NextResponse) return input;

  const tpl = await resolveSystemPrompt(session.user.id, input.templateId);
  if (tpl instanceof NextResponse) return tpl;

  const resolved = await resolveModel(session.user.id, input.keyId, input.model);
  if (resolved instanceof NextResponse) return resolved;

  const result = streamText({
    model: resolved.model,
    system: tpl.systemPrompt,
    prompt: input.prompt,
  });

  if (input.saveHistory) {
    void saveHistoryAsync(
      session.user.id,
      input,
      tpl.templateDbId,
      resolved.providerLabel,
      result,
    );
  }

  return result.toTextStreamResponse();
}
