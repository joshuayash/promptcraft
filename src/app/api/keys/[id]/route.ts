import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 删除当前用户的一个 API Key 配置。 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await ctx.params;
  const deleted = await prisma.apiKey.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到该 API Key 配置" } },
      { status: 404 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
