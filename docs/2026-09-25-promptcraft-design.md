# PromptCraft 设计规格说明

> 状态：已批准（2026-09-25）
> 类型：架构级 / 新项目 MVP
> 核心原则：低消耗——token 消耗低、依赖少、构建快、运行轻量

## 1. 产品定位

**PromptCraft** 是一个开源的 AI 提示词优化 Web 应用（MIT 协议，中文界面，部署到 Vercel）。用户输入原始提示词，选择优化模板和 AI 厂商，通过 LLM 元提示词（meta-prompt）技术生成优化后的提示词，左右分栏对比展示。

## 2. 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js App Router + TypeScript，单包（create-next-app 初始化，`--src-dir`） |
| UI | Tailwind CSS + shadcn/ui |
| 数据库 | SQLite + Prisma |
| 认证 | NextAuth（邮箱/密码），另支持免登录纯本地模式 |
| AI 调用 | Vercel AI SDK：`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic` + `@ai-sdk/google`，流式输出 |
| 部署 | Vercel |

## 3. 核心功能（MVP 范围）

### 3.1 元提示词优化
- 5 个预设模板：通用优化 / 代码助手 / 结构化输出 / 角色强化 / 简洁精炼
- 每个模板是一个精心设计的元提示词（systemPrompt），包装用户输入后发给 LLM
- 用户可创建自定义模板（`/templates` 页面），可复制预设模板作为基础
- 预设模板存数据库（`Template.isPreset = true`），随版本更新

### 3.2 多厂商接入
- 内置预设：OpenAI (GPT)、Anthropic (Claude)、xAI (Grok)、DeepSeek、Moonshot (Kimi)、智谱、通义千问、Gemini
- 自定义厂商：任意端点，三种协议类型可选——OpenAI 兼容 / Anthropic / Gemini
- 依赖 Vercel AI SDK 的多 provider：`createOpenAI({ baseURL })` / `createAnthropic({ baseURL })` / `createGoogleGenerativeAI({ baseURL })` 均支持自定义端点，可接 One-API、Ollama、vLLM 等一切兼容端点
- 模型选择：预设模型列表 + 手动输入任意模型名 + 「刷新」按钮调 `/v1/models` 拉取最新列表
- MVP 不做自定义请求模板（完全私有协议），不做格式转换层——Anthropic 用原生 provider，Gemini 用原生 provider

### 3.3 双模式架构
- **未登录（纯本地模式）**：API key 存 localStorage，优化历史存 localStorage，前端直连厂商 API。CORS 限制由各厂商浏览器支持情况决定（OpenAI 等支持直连，不支持的场景引导用户登录使用后端代理）
- **已登录**：API key AES-256-GCM 加密存服务端数据库；优化历史存数据库（多设备同步）；调用走后端代理（API 路由）
- 未登录用户注册后可提示「将本地历史迁移到账号」（后置任务，MVP 可选）

### 3.4 结果展示
- 左右分栏：原始（只读）vs 优化后（流式输出 + 可编辑）
- 操作：复制 / 重新优化（换模板或模型） / 保存到历史

### 3.5 页面
| 路由 | 功能 |
| --- | --- |
| `/` | 工作台：输入提示词 → 选模板 → 选厂商/模型 → 优化 → 对比展示 |
| `/history` | 优化历史（查看、搜索、复用、删除） |
| `/templates` | 模板管理（查看预设、创建/编辑自定义模板） |
| `/settings` | API key 管理、厂商配置、个人信息 |
| `/login` `/register` | 认证 |

## 4. 数据模型（Prisma schema）

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  apiKeys      ApiKey[]
  histories    OptimizationHistory[]
  templates    Template[]
}

model ApiKey {
  id        String   @id @default(cuid())
  userId    String
  provider  String        // 厂商标识：openai / anthropic / custom-xxx
  apiKey    String        // AES-256-GCM 加密存储
  baseUrl   String?       // 自定义端点时使用
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
}

model Template {
  id           String  @id @default(cuid())
  userId       String? // null = 预设模板
  name         String
  description  String
  systemPrompt String
  isPreset     Boolean @default(false)
  user         User?   @relation(fields: [userId], references: [id])
}

model OptimizationHistory {
  id               String   @id @default(cuid())
  userId           String
  originalPrompt   String
  optimizedPrompt  String
  templateId       String
  provider         String
  model            String
  createdAt        DateTime @default(now())
  user             User @relation(fields: [userId], references: [id])
}
```

## 5. AI 调用设计

### 5.1 统一流式接口
所有厂商走 Vercel AI SDK 的 `streamText()`，前端用 `useCompletion` 或手写 SSE 消费，呈现打字机效果。

### 5.2 未登录 vs 已登录的调用路径
- 未登录：前端 `fetch` 自建 SSE 消费 → 直连各厂商端点
- 已登录：前端 → `/api/optimize` 路由 → 后端解密 key → `streamText()` → 流式返回
- 两条路径共用同一套**厂商连接配置对象**（baseURL、apiKey、模型名、协议类型），后端加密存，未登录版存 localStorage

## 6. 错误处理

- 前端：中文友好提示，区分错误类型（key 无效 / 余额不足 / 网络问题 / 厂商限流）
- 后端：统一错误格式 `{ error: { code, message } }`，HTTP 状态码语义化
- 防抖防重复提交；失败仅手动重试，不自动重试（避免浪费用户 API 额度）
- MVP 不做服务端限流（BYOK 模式）

## 7. 环境变量

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="随机字符串"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="32字节随机hex"   // AES-256-GCM 加密用户 API key
GITHUB_ID=""                     // 可选 OAuth
GITHUB_SECRET=""
```

## 8. 明确不做（MVP 排除项）

- 评分对比（评分 + 建议）
- 多轮迭代优化
- OAuth 登录（架构预留，不实现）
- Docker 自托管（Vercel 部署优先）
- 服务端限流
- 自动重试
- 测试（先跑起来）
- 自定义请求模板（完全私有协议）
- i18n（中文单语）

## 8.1 未登录用户的关键约束（重要）

未登录直连模式下，受浏览器 CORS 限制，部分厂商（如 Anthropic、Gemini）无法从浏览器直接调用。MVP 处理方式：**未登录仅支持 OpenAI 兼容端点直连**；Anthropic/Gemini 原生协议需要登录走后端代理。在 UI 上明确提示该限制。

## 9. 后续迭代方向（非本次范围）

- 评分对比、多轮迭代优化
- OAuth 提供商
- Docker 自托管
- i18n 双语
- 本地历史迁移到账号

## 10. 验收标准

1. `npm run dev` 可启动，`/` 工作台可完成一次完整的「输入 → 优化 → 对比 → 复制/保存」流程
2. 5 个预设模板生效，自定义模板可创建并在工作台选用
3. 8 个内置厂商 + 自定义厂商（任意端点 + 三协议）可配置 key 并完成一次优化
4. 発录后 key 存数据库且为密文，历史存数据库；未登录走 localStorage + 直连
5. 建议的 5 页面全部可用
6. 可部署到 Vercel（SQLite 换 Vercel Postgres 或 Turso，见实现计划讨论）
