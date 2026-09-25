import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

/** 删除一条优化历史。 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  const { id } = await ctx.params;
  const deleted = await prisma.optimizationHistory.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (deleted.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "未找到该历史记录" } },
      { status: 404 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
