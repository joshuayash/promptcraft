# PromptCraft

AI 提示词优化工具 —— 接入多家 LLM 厂商，用 AI 优化你的提示词。

中文界面 / English UI · 中英一键切换 · 游客模式免登录 · 8 家内置厂商 + 自定义端点

## 功能特性

- **元提示词优化**：选择模板 → AI 改写你的提示词 → 左右分栏对比（流式输出）
- **8 个预设优化模板**：通用优化 / 代码助手 / 结构化输出 / 角色强化 / 简洁精炼 / 文学性优化 / 图片生成优化 / 视频生成优化
- **8 家内置厂商**：OpenAI、Anthropic (Claude)、xAI (Grok)、DeepSeek、Moonshot (Kimi)、智谱、通义千问、Gemini
- **自定义厂商**：支持任意端点，四种协议（OpenAI 兼容 / Anthropic / Gemini / Moonshot）
- **自定义模型导入**：手动输入或从 `/v1/models` 拉取模型列表
- **双模式**：
  - 游客模式：免登录，API Key 与历史存浏览器 localStorage，前端直连（支持全部协议）
  - 登录模式：API Key 经 AES-256-GCM 加密存数据库，服务端代理调用
- **中英切换**：界面所有文字支持中文/English 一键切换
- **自定义模板**：创建、编辑、删除你自己的优化模板

## 快速开始（命令行安装）

```bash
# 1. 克隆仓库
git clone https://github.com/joshuayash/promptcraft.git
cd promptcraft

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：NEXTAUTH_SECRET、ENCRYPTION_KEY 用随机值填充
# （本地开发 DATABASE_URL 默认 SQLite 文件，无需额外配置）

# 4. 初始化数据库并启动
npx prisma db push
npm run dev
```

打开 http://localhost:3000

生成随机密钥（填入 .env）：

```bash
# NEXTAUTH_SECRET（任意随机字符串）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ENCRYPTION_KEY（必须是 32 字节 hex，64 个字符）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 使用 npx 一键安装（推荐）

```bash
git clone --depth 1 https://github.com/joshuayash/promptcraft.git my-promptcraft
cd my-promptcraft
npm install
cp .env.example .env   # 填充密钥
npx prisma db push
npm run dev
```

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `NEXTAUTH_URL` | 是 | 本地为 `http://localhost:3000` |
| `NEXTAUTH_SECRET` | 是 | 会话加密密钥（随机生成） |
| `ENCRYPTION_KEY` | 是 | API Key AES-256-GCM 加密密钥（32 字节 hex） |
| `DATABASE_URL` | 是 | 本地 `file:./dev.db`；生产用 Turso `libsql://...` |
| `TURSO_DATABASE_URL` | 生产 | Turso 数据库地址 |
| `TURSO_AUTH_TOKEN` | 生产 | Turso 访问令牌 |

## 部署到 Vercel

1. 推送代码到 GitHub
2. 在 [Turso](https://turso.tech) 创建数据库，取得 `TURSO_DATABASE_URL` 与 `TURSO_AUTH_TOKEN`
3. Vercel 导入项目，配置上述环境变量（`DATABASE_URL` 设为 Turso 的 `libsql://` 地址）
4. 部署后执行一次 `npx prisma db push`（指向 Turso）初始化表结构

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma 7 + libSQL (Turso) · NextAuth v5 · Vercel AI SDK

## 项目脚本

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run start    # 生产启动
npm run lint     # ESLint
npx tsc --noEmit # 类型检查
```

## 许可证

MIT
