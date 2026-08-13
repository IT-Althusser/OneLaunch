# CLAUDE.md — OneLaunch · 一键出海（AI 商品图片生成工作台）

> 进入本仓库先读此文件。硬性要求与 API 约束见 `README.md`；完整 API 文档见 `ModelRouter_API.docx`（只查重点，不要整份搬进代码或文档）。

## 项目简介

跨境 AI 商品图片生成工作台（比赛「场景一：AI 智能上新」· 选定方向：**AI 商品图片生成**）。
核心任务：用 AI 实现从选品到上架的自动化，将新品上架流程从数天压缩至分钟级。
本方案只做一件事：输入商品名称、卖点与可选参考图，自动生成**白底图、场景图、模特图、对比图、尺寸图**，并按 **Amazon / TikTok Shop / Temu / Shopee** 的尺寸与风格矩阵适配输出；扩展能力为图片本地化（背景/文字/模特替换）。

## 硬性规则（红线，不得违反）

1. 不得偏离「AI 商品图片生成」方向与场景一核心任务；跨境为主，目标平台 Amazon、TikTok Shop 优先，兼顾 Temu、Shopee。
2. 所有模型调用必须走 **Model Router API**，不得直连其他渠道。
3. Base URL：`https://model-router.edu-aliyun.com/v1`；认证：`Authorization: Bearer <API Key>`。
4. API Key 只走环境变量 `MODEL_ROUTER_API_KEY`（`apps/server/.env`），**禁止硬编码**、禁止提交到仓库。
5. 产品展示场景使用**流式输出**；`qwq` 系列必须 `stream: true`（本项目未使用 qwq）。
6. 模型选型只用大赛 126 模型清单内的模型（本项目选型表见 `README.md` 一.2）。
7. 所有交付文件统一放 `D:\Java\code\vibe coding\ONE`；代码最终上传 GitHub。

## 技术栈

| 端 | 技术 | 版本基线 |
|---|---|---|
| 前端 | React + TypeScript + Vite + Tailwind CSS | React 18 / Vite 5 / Tailwind 3 |
| 后端 | Node.js + Express + TypeScript | Node ≥20 / Express 4 |
| 工程 | npm workspaces monorepo | npm ≥10 |
| AI 调用 | Model Router API（OpenAI 兼容协议，fetch 直连） | — |

## 目录结构

```text
ONE/
├── README.md                     # 硬性要求 + API 调用重点（附录 A）
├── CLAUDE.md                     # 本文件：规则 / 技术栈 / 命令
├── package.json                  # workspaces 根配置
├── .gitignore
├── apps/
│   ├── web/                      # 前端：图片生成工作台（React 18 + TS + Vite + Tailwind）
│   │   ├── package.json
│   │   ├── vite.config.ts        # /api 代理到后端（默认 3100，见下方端口说明）
│   │   └── src/
│   │       ├── App.tsx           # 工作台主页面
│   │       ├── components/       # TaskForm / StatusSteps / ResultPanel
│   │       ├── api/client.ts     # 后端 API 客户端
│   │       └── types.ts          # 流水线输入/输出类型
│   └── server/                   # 后端：Node ≥20 + Express + TS
│       ├── package.json
│       └── src/
│           ├── index.ts          # 入口
│           ├── config.ts         # 端口 / Base URL / API Key（环境变量）
│           ├── routes/           # images（五图流水线）/ tasks（本地化异步任务）
│           ├── agents/           # orchestrator + profileAgent / promptAgent / imageAgent / qaAgent
│           └── services/         # modelRouter（接口封装）/ models（模型 ID 集中管理）/ platformSpecs（平台规范矩阵）
├── 提交内容_方案概述与技术方案.md
├── 附加材料_架构图.html
├── 附加材料_业务流程图.html
├── 附加材料_产品原型.html
└── ModelRouter_API.docx          # 大赛 API 完整文档（原始件，只读参考）
```

## 常用命令

```bash
# 安装依赖（仓库根目录执行）
npm install

# 启动后端（Express + tsx watch，默认 http://localhost:3000）
npm run dev:server

# 启动前端（Vite dev server，默认 http://localhost:5173）
npm run dev:web

# 构建全部（web: tsc + vite build；server: tsc）
npm run build

# 生产启动后端
npm run start:server
```

端口说明：后端端口由 `PORT` 环境变量控制（默认 3000）。若本机 3000 被占用，用 `PORT=3100` 启动后端，并保持 `apps/web/vite.config.ts` 的 `/api` 代理指向同一端口（当前配置为 3100）。前端 5173 被占用时 Vite 会自动顺延（如 5174）。

环境变量（`apps/server/.env`，从 `.env.example` 复制）：

```bash
MODEL_ROUTER_API_KEY=sk-xxx   # 必填，算力审核通过后发放
# PORT=3100                    # 可选
# MODEL_ROUTER_BASE_URL=...    # 可选，默认官方地址
```

## Model Router 调用速查（重点，完整细节查 docx）

| 能力 | 接口 | 调用方式 | 关键注意 |
|---|---|---|---|
| 文本/视觉对话 | `POST /v1/chat/completions` | 同步/流式 | OpenAI 兼容；视觉模型在 messages 传 image_url；提示词设计/商品画像/质检都走这里 |
| 图片生成/编辑 | `POST /v1/images/generations` | 新版同步/旧版异步 | wan2.7/2.6 同步返回 URL；wan2.5/2.2 加 `X-DashScope-Async: enable` + `input.prompt` |
| 异步任务查询 | `GET /v1/tasks/{task_id}` | GET | 旧版图编辑模型（本地化替换）结果轮询 |

## 核心业务概念

- **五图类型**：白底图、场景图、模特图、对比图、尺寸图（常量 `IMAGE_TYPES`，`apps/server/src/agents/imageAgent.ts`）。
- **平台规范矩阵**：`apps/server/src/services/platformSpecs.ts`，每个平台一条配置（主图尺寸 / 附加尺寸 / 风格要求）；**新增平台只加一条配置，不改流水线代码**。
- **流水线策略**：首个目标平台生成全部五图，其余平台生成白底主图适配版；白底图强制 VL 质检。
- **降级策略**：无参考图时商品画像降级为纯文本；任一子 Agent 失败记录步骤状态并继续，不中断整体流水线。

## 代码规范

- TypeScript strict 模式；避免 `any`。
- 模型 ID 集中在 `apps/server/src/services/models.ts` 管理，禁止散落硬编码。
- 异步任务（旧版图片编辑模型）统一走 task 轮询封装，带超时与重试。
- 错误处理：对 Model Router 返回的 4xx/5xx 给出可读提示，不吞异常。
- 提交信息遵循 Conventional Commits（feat/fix/docs/refactor 等）。
- 新增功能前先对照 `README.md` 硬性要求自检，不得偏离图片生成方向。
