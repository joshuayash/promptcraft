import type { DefaultSession } from "next-auth";

// NextAuth 会话类型扩展：session.user.id 始终可用（JWT sub）
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
