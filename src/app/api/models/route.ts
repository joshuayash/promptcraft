import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { resolveBaseUrl, DEFAULT_BASE_URLS } from "@/lib/providers";
import type { Protocol } from "@/lib/types";

/** 从厂商端点拉取 /v1/models 模型列表。 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  let body: { keyId?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const keyId = String(body?.keyId ?? "");
  if (!keyId) {
    return NextResponse.json(
      { error: { code: "MISSING_KEY", message: "请选择 API Key 配置" } },
      { status: 400 },
    );
  }

  const keyRow = await prisma.apiKey.findFirst({
    where: { id: keyId, userId: session.user.id },
  });
  if (!keyRow) {
    return NextResponse.json(
      { error: { code: "UNKNOWN_KEY", message: "未找到该 API Key 配置" } },
      { status: 400 },
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(keyRow.apiKeyEnc);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "DECRYPT_FAILED",
          message: "API Key 解密失败，请删除后重新添加（ENCRYPTION_KEY 可能已更换）",
        },
      },
      { status: 500 },
    );
  }

  const protocol = keyRow.protocol as Protocol;
  const baseUrl = resolveBaseUrl(keyRow.provider, keyRow.baseUrl);

  try {
    const models = await fetchModels(protocol, apiKey, baseUrl);
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "网络错误";
    return NextResponse.json(
      { error: { code: "FETCH_MODELS_FAILED", message } },
      { status: 502 },
    );
  }
}

async function fetchModels(
  protocol: Protocol,
  apiKey: string,
  baseUrl: string | undefined,
): Promise<string[]> {
  if (protocol === "anthropic") {
    return fetchAnthropicModels(apiKey, baseUrl);
  }
  if (protocol === "gemini") {
    return fetchGeminiModels(apiKey, baseUrl);
  }
  return fetchOpenAIModels(apiKey, baseUrl);
}

/** OpenAI 兼容协议: GET {baseUrl}/models, Authorization: Bearer。 */
async function fetchOpenAIModels(
  apiKey: string,
  baseUrl: string | undefined,
): Promise<string[]> {
  const url = `${baseUrl ?? DEFAULT_BASE_URLS.openai}/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(await errorHint(res, "拉取模型列表失败"));
  }
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  return extractIds(data.data, (m) => m.id);
}

/** Anthropic 协议: GET {baseUrl}/v1/models, x-api-key + anthropic-version。 */
async function fetchAnthropicModels(
  apiKey: string,
  baseUrl: string | undefined,
): Promise<string[]> {
  const url = `${baseUrl ?? DEFAULT_BASE_URLS.anthropic}/v1/models?limit=1000`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) {
    throw new Error(await errorHint(res, "拉取模型列表失败"));
  }
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  return extractIds(data.data, (m) => m.id);
}

/** Gemini 协议: GET {baseUrl}/v1beta/models?key=。 */
async function fetchGeminiModels(
  apiKey: string,
  baseUrl: string | undefined,
): Promise<string[]> {
  const url = `${baseUrl ?? DEFAULT_BASE_URLS.gemini}/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(await errorHint(res, "拉取模型列表失败"));
  }
  const data = (await res.json()) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  return extractIds(
    data.models?.filter((m) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"),
    ),
    (m) => m.name?.replace(/^models\//, ""),
  );
}

/** 提取非空 id 并排序。 */
function extractIds<T>(
  items: T[] | undefined,
  pick: (item: T) => string | undefined,
): string[] {
  const ids = (items ?? []).flatMap((item) => {
    const id = pick(item);
    return id ? [id] : [];
  });
  return ids.sort((a, b) => a.localeCompare(b));
}

/** 从失败响应提取中文错误提示（key 无效 / 余额不足 / 限流等）。 */
async function errorHint(res: Response, fallback: string): Promise<string> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    detail = "";
  }
  if (res.status === 401 || res.status === 403) {
    return "API Key 无效或无权限";
  }
  if (res.status === 402) {
    return "账户余额不足";
  }
  if (res.status === 429) {
    return "请求过于频繁，请稍后再试";
  }
  return detail ? `${fallback}: ${detail}` : fallback;
}
