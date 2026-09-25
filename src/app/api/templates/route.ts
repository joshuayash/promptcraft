import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 列出当前用户自定义模板（预设模板由前端常量提供，不入库）。 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const rows = await prisma.template.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      systemPrompt: r.systemPrompt,
      isPreset: false,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

/** 新建自定义模板。 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  let body: { name?: string; description?: string; systemPrompt?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const systemPrompt = String(body?.systemPrompt ?? "").trim();

  if (!name) {
    return NextResponse.json(
      { error: { code: "MISSING_NAME", message: "模板名称不能为空" } },
      { status: 400 },
    );
  }
  if (!systemPrompt) {
    return NextResponse.json(
      { error: { code: "MISSING_PROMPT", message: "模板提示词不能为空" } },
      { status: 400 },
    );
  }

  const row = await prisma.template.create({
    data: { userId: session.user.id, name, description, systemPrompt, isPreset: false },
  });
  return NextResponse.json(
    {
      id: row.id,
      name: row.name,
      description: row.description,
      systemPrompt: row.systemPrompt,
      isPreset: false,
      createdAt: row.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
