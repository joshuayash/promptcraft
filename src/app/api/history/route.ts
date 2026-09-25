import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 优化历史列表（登录用户，倒序分页）。 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "请先登录" } },
      { status: 401 },
    );
  }
  let params: URLSearchParams;
  try {
    params = new URL(req.url).searchParams;
  } catch {
    params = new URLSearchParams();
  }
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number(params.get("pageSize") ?? "20") || 20),
  );

  const [items, total] = await Promise.all([
    prisma.optimizationHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { template: { select: { name: true } } },
    }),
    prisma.optimizationHistory.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    items: items.map((row) => ({
      id: row.id,
      originalPrompt: row.originalPrompt,
      optimizedPrompt: row.optimizedPrompt,
      templateId: row.templateId,
      templateName: row.template?.name ?? null,
      provider: row.provider,
      model: row.model,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  });
}
