# CLAUDE.md — OneLaunch · 一键出海（AI 商品图片生成工作台）

> 进入本仓库先读此文件。硬性要求与 API 约束见 `README.md`；完整 API 文档见 `ModelRouter_API.docx`（只查重点，不要整份搬进代码或文档）。

## 项目简介

跨境 AI 商品图片生成工作台（比赛「场景一：AI 智能上新」· 选定方向：**AI 商品图片生成**）。
核心任务：用 AI 实现从选品到上架的自动化，将新品上架流程从数天压缩至分钟级。
本方案只做一件事：输入商品名称与卖点，自动生成**白底图、场景图、模特图、对比图、尺寸图**，并按 **Amazon / TikTok Shop / Temu / Shopee** 的风格要求适配输出；扩展能力为图片本地化（背景/画面风格替换）。

## 硬性规则（红线，不得违反）

1. 不得偏离「AI 商品图片生成」方向与场景一核心任务；跨境为主，目标平台 Amazon、TikTok Shop 优先，兼顾 Temu、Shopee。
2. 所有模型调用必须走 **Model Router API**，不得直连其他渠道。
3. Base URL：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`；认证：`Authorization: Bearer <API Key>`。
4. API Key 只走环境变量 `MODEL_ROUTER_API_KEY`（`apps/server/.env`），**禁止硬编码**、禁止提交到仓库。
5. 大赛要求产品展示场景流式输出，但 Token Plan 网关实测仅支持同步调用（含图片能力），本项目全部为同步调用；`qwq` 系列必须 `stream: true`（本项目未使用 qwq）。
6. 模型选型只用大赛 126 模型清单内的模型（本项目选型表见 `README.md` 一.2）。
7. 所有交付文件统一放 `D:\Java\code\vibe coding\ONE`；代码最终上传 GitHub。

## 技术栈

| 端 | 技术 | 版本基线 |
|---|---|---|
| 前端 | React + TypeScript + Vite + Tailwind CSS | React 18 / Vite 5 / Tailwind 3 |
| 后端 | Java + Spring Boot + Spring AI | Java 25 / Spring Boot 4.0.6 / Spring AI 2.0.1（Jackson 3：`tools.jackson`） |
| 工程 | npm workspaces monorepo（前端）+ Maven（后端） | npm ≥10 |
| AI 调用 | Spring AI ChatClient + Token Plan 图片客户端 | Spring AI 2.0.1 |

## 目录结构

```text
ONE/
├── README.md                     # 硬性要求 + API 调用重点（附录 A）
├── CLAUDE.md                     # 本文件：规则 / 技术栈 / 命令
├── package.json                  # 前端脚本 + Java 后端 Maven 命令
├── .gitignore
├── apps/
│   ├── web/                      # 前端：图片生成工作台（React 18 + TS + Vite + Tailwind）
│   │   ├── package.json
│   │   ├── vite.config.ts        # /api 代理到后端（默认 3100，见下方端口说明）
│   │   └── src/
│   │       ├── App.tsx           # 工作台主页面
│   │       ├── components/       # TaskForm / StatusSteps / ResultPanel / RightPanel / Sidebar
│   │       ├── api/client.ts     # 后端 API 客户端
│   │       └── types.ts          # 流水线输入/输出类型
│   └── server/                   # 后端：Java 25 + Spring Boot 4 + Spring AI（Maven 工程）
│       ├── pom.xml               # Spring Boot 4.0.6 + Spring AI 2.0.1 依赖
│       ├── .env / .env.example   # API Key 等环境变量（.env 不入库）
│       └── src/main/
│           ├── java/com/onelaunch/
│           │   ├── ServerApplication.java      # 入口
│           │   ├── ApiController.java          # /api 路由
│           │   ├── ImagePipelineService.java   # 五图流水线编排
│           │   ├── ModelRouterImageClient.java # 图片生成/编辑客户端（/chat/completions）
│           │   ├── TokenPlanChatModel.java     # Spring AI ChatModel 实现（文本）
│           │   ├── ChatClientConfig.java       # ChatClient 装配
│           │   ├── HttpClientConfig.java       # RestClient 超时配置
│           │   └── ApiModels.java              # 请求/响应模型
│           └── resources/application.yml       # 端口 / Base URL / 模型 ID 集中管理
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

# 启动后端（Spring Boot，默认 http://localhost:3100）
npm run dev:server

# 启动前端（Vite dev server，默认 http://localhost:5173）
npm run dev:web

# 构建全部（web: tsc + vite build；server: Maven package）
npm run build

# 生产启动后端
mvn -f apps/server/pom.xml spring-boot:run
```

端口说明：后端端口由 `PORT` 环境变量控制（默认 3100），并与 `apps/web/vite.config.ts` 的 `/api` 代理保持一致。前端 5173 被占用时 Vite 会自动顺延（如 5174）。

环境变量（`apps/server/.env`，从 `.env.example` 复制）：

```bash
MODEL_ROUTER_API_KEY=sk-xxx   # 必填，算力审核通过后发放
# PORT=3100                    # 可选
# MODEL_ROUTER_BASE_URL=...    # 可选，默认 Token Plan 专属地址
# MODEL_ROUTER_TEXT_MODEL=qwen3.7-max        # 可选，文本模型
# MODEL_ROUTER_IMAGE_MODEL=wan2.7-image-pro  # 可选，文生图模型
# MODEL_ROUTER_EDIT_MODEL=qwen-image-2.0     # 可选，图生图编辑模型
# MODEL_ROUTER_TIMEOUT_SECONDS=120           # 可选，单次调用读超时
```

## Model Router 调用速查（Token Plan 实测结论，与 docx 文档有差异）

Token Plan 网关上**所有能力统一走 `POST /v1/chat/completions`**（同步）：

| 能力 | 模型 | messages[0].content | 响应取值 |
|---|---|---|---|
| 文本对话（商品画像/提示词） | `qwen3.7-max` | 纯字符串 | `choices[0].message.content`（字符串） |
| 文生图（五图生成） | `wan2.7-image-pro` | 数组 `[{type:"text", text:...}]` | `output.choices[0].message.content[].image` |
| 图生图（本地化编辑） | `qwen-image-2.0` | 数组 `[{type:"image", image:url}, {type:"text", text:...}]` | 同上 |

实测不可用（勿再尝试）：
- `POST /v1/images/generations` → 直接返回 400 `url error`；
- `X-DashScope-Async: enable` 异步 → 403 `current user api does not support asynchronous calls`；
- OpenAI 的 `image_url` 嵌套格式 → 400 `Either 'text' or 'image' must be provided, but not both`（图片 part 必须是 `type=image` + `image=url` 扁平字段）；
- Token Plan 可用模型清单可通过 `GET /v1/models` 获取（当前 24 个，**无 VL 视觉模型**）。

## API 路由速查

- `GET /api/health`：健康检查。
- `POST /api/images/set`：五图 + 详情页流水线。
- `POST /api/images/single`：单图重生成（同步返回图片）。
- `POST /api/images/localize`：图片本地化（同步图生图编辑，直接返回结果图）。

完整接入方式见 `docs/integration-guide.md`，运维见 `docs/runbook.md`，架构见 `docs/architecture.md`。

## 核心业务概念

- **五图类型**：白底图、场景图、模特图、对比图、尺寸图（常量 `IMAGE_TYPES`，`apps/server/src/main/java/com/onelaunch/ImagePipelineService.java`）。
- **平台策略**：首个目标平台生成全部五图，其余平台生成白底主图适配版。
- **降级策略**：商品画像失败降级为纯文本拼接；Token Plan 无 VL 模型，白底图质检为生成确认 + 人工复检提醒；任一步骤失败记录到 `steps` 并继续，不中断整体流水线。

## 代码规范

- TypeScript strict 模式；避免 `any`。
- Jackson 3：后端统一 `import tools.jackson.databind.JsonNode`（不是 `com.fasterxml.jackson`）。
- 模型 ID 集中在 `apps/server/src/main/resources/application.yml` 管理，禁止散落硬编码。
- 错误处理：对 Model Router 返回的 4xx/5xx 给出可读提示，不吞异常。
- 提交信息遵循 Conventional Commits（feat/fix/docs/refactor 等）。
- 新增功能前先对照 `README.md` 硬性要求自检，不得偏离图片生成方向。
