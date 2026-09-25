import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** 邮箱/密码注册。成功返回 201；错误统一 { error: { code, message } }。 */
export async function POST(req: Request) {
  try {
    let body: { email?: string; password?: string } | null = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const email = String(body?.email ?? "")
      .toLowerCase()
      .trim();
    const password = String(body?.password ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: { code: "INVALID_EMAIL", message: "邮箱格式不正确" } },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: { code: "WEAK_PASSWORD", message: "密码至少需要 8 个字符" } },
        { status: 400 },
      );
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { error: { code: "EMAIL_TAKEN", message: "该邮箱已注册，请直接登录" } },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    console.error("register failed:", e);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "服务器开小差了，请稍后重试" } },
      { status: 500 },
    );
  }
}
