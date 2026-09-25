# PromptCraft 桌面版规划

- 版本：v0.1（规划草案，待 grill）
- 日期：2026-09-26
- 前置状态：Web 版 MVP 已完成并上线 GitHub（joshuayash/promptcraft）

---

## 1. 目标与动机

将 PromptCraft 从纯 Web 应用扩展为可本地运行的桌面应用，解决：

1. **免部署** — 用户无需 Vercel/Turso，双击即用
2. **数据本地化** — API Key、历史记录完全留在本机，隐私敏感用户友好
3. **离线可用** — 除 AI 调用本身需联网外，界面与历史查询离线可用
4. **系统级体验** — 全局快捷键唤起、系统托盘、原生窗口

## 2. 形态决策（待 grill 确认）

| 选项 | 体积 | 内存占用 | 前端复用度 | 打包复杂度 | 备注 |
| --- | --- | --- | --- | --- | --- |
| A. Electron | ~150MB+ | 高（Chromium 整包） | 100% 复用现有 Next.js 前端 | 低（electron-builder 成熟） | 生态最成熟，但与「低消耗」硬约束冲突 |
| B. Tauri 2 | ~10MB | 低（系统 WebView） | 100% 复用（静态导出） | 中（Rust 工具链、签名） | 推荐——符合低消耗约束 |
| C. PWA | 0 | 低 | 100% 复用 | 极低 | 非真桌面应用，能力受限（无托盘/全局快捷键） |

**倾向：B（Tauri 2）**。理由：项目硬约束「以消耗低为目标」，Tauri 安装包约 10MB、运行内存远低于 Electron；前端几乎零改动（Next.js 静态导出模式）。

## 3. 架构设计

```text
┌─────────────────────────────────────┐
│  Tauri 窗口（系统 WebView）          │
│  ┌───────────────────────────────┐  │
│  │  Next.js 静态导出的前端        │  │
│  │  （现有 UI 100% 复用）         │  │
│  └──────────────┬────────────────┘  │
│                 │ Tauri IPC          │
│  ┌──────────────▼────────────────┐  │
│  │  Rust 核心（薄层）             │  │
│  │  · 本地 SQLite（rusqlite）     │  │
│  │  · Key 加密（系统 keyring）    │  │
│  │  · HTTP 代理（reqwest，转发 AI │  │
│  │    请求，规避 WebView CORS）   │  │
│  │  · 全局快捷键 / 托盘           │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

关键决策：

| 问题 | 方案 |
| --- | --- |
| 渲染 | 系统 WebView（Win: WebView2 / macOS: WKWebView），Next.js `output: 'export'` 静态导出 |
| 数据库 | 本地 SQLite 文件（与 Web 版同一 libSQL 方言，schema 不变） |
| 身份认证 | **移除登录**——桌面单机场景无需账号体系，简化为纯本地模式（复用游客模式代码路径） |
| API Key 存储 | 系统 keyring（Windows Credential Manager / macOS Keychain），比 AES 加密文件更安全且免去 ENCRYPTION_KEY 管理 |
| AI 请求 | Rust 侧 reqwest 转发 → 规避 WebView CORS，三种协议都可用，不再受浏览器限制 |
| 流式输出 | Tauri event 通道逐 chunk 推送，前端与现有流式 UI 对接 |

## 4. 功能范围

### MVP（桌面版 v1.0）

- [ ] 现有 Web 版全部功能（8 模板、8 厂商、自定义厂商、模型导入、中英切换）
- [ ] 本地 SQLite 历史记录（替代 localStorage，支持全文搜索）
- [ ] API Key 存系统 keyring
- [ ] 窗口最小化到系统托盘
- [ ] 全局快捷键唤起（如 Ctrl+Shift+P）

### v1.1+（后续）

- [ ] 开机自启动
- [ ] 剪贴板监听：选中文字 → 快捷键 → 直接优化
- [ ] 多窗口/置顶
- [ ] Web 版数据导入（导出的 history.json）
- [ ] 自动更新（Tauri updater）

### 明确不做

- 云同步（与桌面本地化定位冲突）
- 账号体系（见上）
- 移动端（Tauri mobile 留待评估）

## 5. 技术风险与验证点

| 风险 | 验证方式 |
| --- | --- |
| Next.js 静态导出与现有动态 API 路由冲突 | 需要把 `/api/*` 全部迁移到 Rust IPC——工作量主要在这里，先验证 optimize 一条链路 |
| 流式 SSE 经 Tauri event 的延迟 | 原型验证 streamText → event emit → 前端打字机 |
| 系统 keyring 在三平台的兼容 | tauri-plugin-stronghold 或 keyring crate 验证 |
| 打包签名（Windows SmartScreen / macOS Gatekeeper） | 未签名包会告警，先不签名发布 Beta |

## 6. 里程碑

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| M1 原型 | Tauri 壳 + 静态导出的前端跑通；optimize 走 Rust reqwest 流式转发 | 完成一次完整优化流程 |
| M2 数据层 | SQLite 迁移 + keyring 存储 + 历史/模板/Key 管理全走 IPC | 功能与 Web 版对齐 |
| M3 桌面体验 | 托盘、全局快捷键、窗口行为 | 快捷键唤起→优化→复制闭环 |
| M4 发布 | electron-builder → tauri build，GitHub Release 发布三平台安装包 | Windows/macOS/Linux 可安装运行 |

## 7. 与 Web 版的关系

- 同一仓库 monorepo 演进：`/`（Next.js）+ `src-tauri/`（Rust）
- Web 版继续维护（Vercel 部署不受影响）
- 静态导出与 SSR 双模式通过条件导出/环境变量切换；动态 API 路由仅 Web 版使用

## 8. 思考题（待 grill）

1. 登录体系在桌面版真的直接砍掉，还是保留「可选同步」的接口预留？
2. Tauri 的 Rust 学习成本 vs Electron 的开箱即用——团队（你）的 Rust 接受度？
3. 静态导出意味着 Web 版与桌面版构建产物不同，如何避免两个版本前端分叉？
4. 桌面版是否还需要「登录模式」下的服务端代理优势（key 不落前端）？keyring 已覆盖此需求？
