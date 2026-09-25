import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** 更新自定义模板。 */
export async function PUT(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await ctx.params;
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

  const row = await prisma.template.updateMany({
    where: { id, userId: session.user.id },
    data: { name, description, systemPrompt },
  });
  if (row.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到该模板" } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

/** 删除自定义模板。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await ctx.params;
  const deleted = await prisma.template.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到该模板" } },
      { status: 404 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
