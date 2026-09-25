import { defineConfig, env } from "prisma/config";

// Prisma 7 CLI 不再自动加载 .env（Node >= 20.6 原生支持）
try {
  process.loadEnvFile(".env");
} catch {
  // 生产环境中由平台注入环境变量
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  // 本地开发用 SQLite 文件；生产部署时将 DATABASE_URL 指向 Turso libsql URL
  datasource: {
    url: env("DATABASE_URL"),
  },
});
