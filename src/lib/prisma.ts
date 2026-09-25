import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/**
 * Prisma Client 单例（Next.js dev 热重载防泄漏）。
 * Prisma 7 中 driver adapter 必选：
 * - 本地开发：DATABASE_URL=file:./dev.db（libSQL 文件驱动）
 * - 生产（Vercel）：DATABASE_URL=libsql://…（Turso 远端 + TURSO_AUTH_TOKEN）
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
// SAFETY: globalThis 上无类型信息的全局缓存位，仅存放本模块创建的 PrismaClient 单例，结构由本文件唯一控制

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("缺少 DATABASE_URL 环境变量");

  return new PrismaClient({
    adapter: new PrismaLibSql({
      url,
      authToken: url.startsWith("libsql://") ? process.env.TURSO_AUTH_TOKEN : undefined,
    }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
