import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, maskKey } from "@/lib/crypto";
import { PROVIDERS, getProvider } from "@/lib/providers";
import type { ApiKeyView, Protocol } from "@/lib/types";

function toView(row: {
  id: string;
  label: string;
  provider: string;
  protocol: string;
  baseUrl: string | null;
  apiKeyEnc: string;
  createdAt: Date;
}): ApiKeyView {
  let masked = "••••";
  try {
    masked = maskKey(decryptSecret(row.apiKeyEnc));
  } catch {
    // 解密失败（如 ENCRYPTION_KEY 换过）时仍展示行，仅脱敏字段降级
  }
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    protocol: row.protocol as Protocol,
    baseUrl: row.baseUrl,
    maskedKey: masked,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 列出当前用户全部 API Key 配置（脱敏）。 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const rows = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(toView));
}

/** 新增 API Key 配置（AES-256-GCM 加密入库）。 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }

  let body: {
    label?: string;
    provider?: string;
    protocol?: string;
    baseUrl?: string;
    apiKey?: string;
  } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const provider = String(body?.provider ?? "");
  const apiKey = String(body?.apiKey ?? "").trim();
  let protocol: Protocol | null = null;
  let label = String(body?.label ?? "").trim();

  if (provider === "custom") {
    protocol = (["openai", "anthropic", "gemini", "moonshot"] as const).includes(
      body?.protocol as Protocol,
    )
      ? (body?.protocol as Protocol)
      : null;
    if (!protocol) {
      return NextResponse.json(
        { error: { code: "INVALID_PROTOCOL", message: "自定义厂商必须选择协议类型" } },
        { status: 400 },
      );
    }
    if (!String(body?.baseUrl ?? "").trim()) {
      return NextResponse.json(
        { error: { code: "MISSING_BASE_URL", message: "自定义厂商必须填写 API 端点" } },
        { status: 400 },
      );
    }
    if (!label) {
      return NextResponse.json(
        { error: { code: "MISSING_LABEL", message: "自定义厂商必须填写名称" } },
        { status: 400 },
      );
    }
  } else {
    const preset = getProvider(provider);
    if (!preset) {
      return NextResponse.json(
        {
          error: {
            code: "UNKNOWN_PROVIDER",
            message: `不支持的厂商：${provider}（可选：${PROVIDERS.map((p) => p.id).join("、")} 或 custom）`,
          },
        },
        { status: 400 },
      );
    }
    protocol = preset.protocol;
    if (!label) label = preset.name;
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: { code: "MISSING_KEY", message: "请填写 API Key" } },
      { status: 400 },
    );
  }

  const row = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      label,
      provider,
      protocol,
      apiKeyEnc: encryptSecret(apiKey),
      baseUrl: String(body?.baseUrl ?? "").trim() || null,
    },
  });
  return NextResponse.json(toView(row), { status: 201 });
}
