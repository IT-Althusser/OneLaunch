# CLAUDE.md — OneLaunch · 一键出海（AI 商品图片生成工作台）

> 进入本仓库先读此文件。硬性要求与 API 约束见 `README.md`；完整 API 文档见 `ModelRouter_API.docx`（只查重点，不要整份搬进代码或文档）。

## 项目简介

跨境 AI 商品图片生成工作台（比赛「场景一：AI 智能上新」· 选定方向：**AI 商品图片生成**）。
核心任务：用 AI 实现从选品到上架的自动化，将新品上架流程从数天压缩至分钟级。
主选方向 1：输入商品资料与参考图，生成**白底图、场景图、模特图、对比图、尺寸图**，按 **Amazon / TikTok Shop / Temu / Shopee** 差异化出图；已实现详情页自动化、本地化三维度（背景/文字/模特）与全图类跨境合规检测。Listing 写作尚未实现。

## 硬性规则（红线，不得违反）

1. 不得偏离「AI 商品图片生成」方向与场景一核心任务；跨境为主，目标平台 Amazon、TikTok Shop 优先，兼顾 Temu、Shopee。
2. 所有模型调用必须走 **Model Router API**，不得直连其他渠道。
3. Base URL：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`；认证：`Authorization: Bearer <API Key>`。
4. API Key 只走环境变量 `MODEL_ROUTER_API_KEY`（`apps/server/.env`），**禁止硬编码**、禁止提交到仓库。
5. 大赛要求产品展示场景流式输出，但 Token Plan 网关实测仅支持同步调用（含图片能力），本项目全部为同步调用；`qwq` 系列必须 `stream: true`（本项目未使用 qwq）。
6. 模型选型只用大赛 126 模型清单内的模型（本项目选型表见 `README.md` 一.2）。
7. 所有交付文件统一放 `D:\Java\code\vibe coding\ONE`；代码上传 GitCode（复赛要求；私有仓库需授权评审账号 `air__Heaven`）。

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
│   │   ├── vite.config.ts        # /api 代理到后端（默认 3101，见下方端口说明）
│   │   └── src/
│   │       ├── App.tsx           # 工作台编排：创作工作台 / 生成工作台双 tab
│   │       ├── components/       # CreatePanel（01 参考图+02 商品资料三区布局）/ StudioView（槽位+思考日志+单图操作）/ ToolWorkbench（侧栏工具的单图工作台整页）/ DetailWorkbench + DetailPages（AI 详情页）/ ComplianceIssues / ImageLightbox / ReferenceUploader / RightPanel（03 模型与调用）/ Sidebar
│   │       ├── api/client.ts     # 后端 API 客户端（含 SSE 流式解析）
│   │       └── types.ts          # 流水线输入/输出类型
│   └── server/                   # 后端：Java 25 + Spring Boot 4 + Spring AI（Maven 工程）
│       ├── pom.xml               # Spring Boot 4.0.6 + Spring AI 2.0.1 依赖
│       ├── .env / .env.example   # API Key 等环境变量（.env 不入库）
│       └── src/main/
│           ├── java/com/onelaunch/
│           │   ├── ServerApplication.java      # 入口
│           │   ├── ApiController.java          # /api 路由（含 /api/models 与 SSE 流式端点）
│           │   ├── ImagePipelineService.java   # 五图流水线编排（同步 + SSE 事件流双模式，含 P3 本体检验与修复回流）
│           │   ├── ModelRouterImageClient.java # 图片生成/编辑客户端（/chat/completions，支持 base64 参考图与模型覆盖）
│           │   ├── ModelRouterVisionClient.java# 视觉理解客户端（全图质检与合规检测：平台规范 + P3 商品本体一致性，嵌套 image_url 传图）
│           │   ├── TokenPlanChatModel.java     # Spring AI ChatModel 实现（文本，支持按请求覆盖模型）
│           │   ├── ChatClientConfig.java       # ChatClient 装配
│           │   ├── HttpClientConfig.java       # RestClient 超时配置
│           │   ├── ApiModels.java              # 请求/响应模型（含参考图与模型覆盖字段）
│           │   ├── ApiErrors.java              # 统一错误解析与图片 URL 校验
│           │   ├── ComplianceRuleLibrary.java  # 合规规则知识库加载（platform 注入提示词，market 仅展示）
│           │   ├── WhiteBackgroundSanitizer.java    # 确定性白底化（Java 2D 泛洪填充，白底图直出路径）
│           │   ├── CompositeCompareRenderer.java    # 确定性对比图渲染（左全景 + 右 bbox 自适应特写）
│           │   └── DimensionGuideRenderer.java      # 尺寸图本地渲染器（Java 2D 尺寸标注图）
│           └── resources/
│               ├── application.yml             # 端口 / Base URL / 模型 ID / qa-scope
│               └── compliance-rules/           # 合规规则知识库：platform/ 4 文件 + market/ 5 文件
├── 提交内容_方案概述与技术方案.md
├── 附加材料_架构图.html
├── 附加材料_业务流程图.html
├── 附加材料_产品原型.html
├── DESIGN.md                     # 设计系统（色彩 / 字体 / 组件语言，impeccable 用）
├── PRODUCT.md                    # 产品定义（用户路径与成功标准）
├── docs/                         # 架构 / 接入 / 运维 / 变更记录
│   ├── architecture.md
│   ├── integration-guide.md
│   ├── runbook.md
│   └── CHANGES.md
└── ModelRouter_API.docx          # 大赛 API 完整文档（原始件，只读参考）
```

## 常用命令

```bash
# 安装依赖（仓库根目录执行）
npm install

# 启动后端（Spring Boot，默认 http://localhost:3101）
npm run dev:server

# 启动前端（Vite dev server，默认 http://localhost:5173）
npm run dev:web

# 构建全部（web: tsc + vite build；server: Maven package）
npm run build

# 生产启动后端
mvn -f apps/server/pom.xml spring-boot:run
```

端口说明：后端端口由 `PORT` 环境变量控制（默认 3101，2026-09-08 起从 3100 调整），并与 `apps/web/vite.config.ts` 的 `/api` 代理保持一致。前端 5173 被占用时 Vite 会自动顺延（如 5174）。

环境变量（`apps/server/.env`，从 `.env.example` 复制）：

```bash
MODEL_ROUTER_API_KEY=sk-xxx   # 必填，算力审核通过后发放
# PORT=3101                    # 可选
# MODEL_ROUTER_BASE_URL=...    # 可选，默认 Token Plan 专属地址
# MODEL_ROUTER_TEXT_MODEL=qwen3.7-max        # 可选，文本模型
# MODEL_ROUTER_VISION_MODEL=qwen3.6-plus     # 可选，白底图视觉质检模型（126 清单内具备视觉能力）
# MODEL_ROUTER_IMAGE_MODEL=wan2.7-image-pro  # 可选，文生图模型
# MODEL_ROUTER_EDIT_MODEL=qwen-image-2.0     # 可选，图生图编辑模型
# MODEL_ROUTER_TIMEOUT_SECONDS=120           # 可选，单次调用读超时
# MODEL_ROUTER_QA_SCOPE=all                  # 可选，all=全部图类，white=仅白底图
```

## Model Router 调用速查（Token Plan 实测结论，与 docx 文档有差异）

Token Plan 网关上**所有能力统一走 `POST /v1/chat/completions`**（同步）：

| 能力 | 模型 | messages[0].content | 响应取值 |
|---|---|---|---|
| 文本对话（商品画像/提示词） | `qwen3.7-max` | 纯字符串 | `choices[0].message.content`（字符串） |
| 文生图（五图生成） | `wan2.7-image-pro` | 数组 `[{type:"text", text:...}]` | `output.choices[0].message.content[].image` |
| 图生图（本地化编辑） | `qwen-image-2.0` | 数组 `[{type:"image", image:url}, {type:"text", text:...}]` | 同上 |
| 视觉理解（白底图质检） | `qwen3.6-plus`（或 `qwen3.6-flash`） | 数组 `[{type:"image_url", image_url:{url:...}}, {type:"text", text:...}]`（OpenAI 嵌套格式，URL/base64 均可） | `choices[0].message.content`（建议 `"enable_thinking": false`，否则思维链进 `reasoning_content`） |

实测不可用（勿再尝试）：
- `POST /v1/images/generations` → 直接返回 400 `url error`；
- `X-DashScope-Async: enable` 异步 → 403 `current user api does not support asynchronous calls`；
- 图片**生成/编辑**模型的 `image_url` 嵌套格式 → 400 `Either 'text' or 'image' must be provided, but not both`（这两类模型图片 part 必须是 `type=image` + `image=url` 扁平字段；**视觉理解模型相反，必须用嵌套格式**）；
- `qwen3.7-max` 传图（任何格式）→ 报错，确认纯文本。

实测可用（2026-08-30）：
- 图生图 `image` 字段接受公网 URL **和** `data:image/...;base64`（本地图直传）；
- 单次图生图调用可传**多张参考图**（多个 `{type:"image"}` part，上限 6）；
- **视觉理解不体现在 `/v1/models` 清单**（清单无 `vl` 字样，实测 23 个模型）：文本档 `qwen3.6-plus` / `qwen3.6-flash`（126 清单内）实测为多模态视觉模型，嵌套 `image_url` 传图 + base64 均可用（图片宽高须大于 10px、单图最高 1600 万像素），`enable_thinking:false` 后 `content` 直接返回答案；`qwen3.7-plus` / `qwen3.8-max` / `qwen3.8-flash` 实测同样视觉可用，但**不在 126 清单内，不作选型**（红线 6）。

## API 路由速查

- `GET /api/health`：健康检查。
- `GET /api/models`：网关模型清单按能力分组（文生图/图生图/文本/视觉/其他 + `visionAvailable`；供前端「模型与调用」面板）。
- `GET /api/image-proxy`：同源图片代理（`?url=`，`download=true` 下载），供前端画幅裁切与下载原图；仅 http(s)。
- `POST /api/images/set`：五图 + 详情页流水线（同步；支持 `referenceImages` 参考图与 `imageModel`/`editModel`/`textModel`/`visionModel` 模型覆盖；详情页为 AI 按平台规范自动编排，失败降级模板；白底图自动视觉质检，失败降级人工复检提醒）。
- `POST /api/images/set/stream`：同上但为 SSE 流式（事件：log / profile / image_start / image_done / image_fail / qa / done / fatal）。
- `POST /api/images/single`：单图生成（三分支：文生图 / referenceImages 参考图生成 / sourceUrl 基于已生成图修改），供侧栏工具工作台与槽位「重新生成 / 修改」。
- `POST /api/images/localize`：图片本地化（同步图生图编辑；支持场景/文字/模特维度、目标语言和模特形象）。
- `POST /api/compliance-check`：单图合规检测（合并 P3 本体检验：`referenceImageUrl` 传商品原始参考图时，参考图+待检图一次视觉调用同时输出「①平台规范与图类要求 ②商品本体一致性」两项结论；不传时仅平台规范与图类要求。检测范围仅平台相关——不含商标授权、广告法与市场法规；dimension 枚举：平台规范/商品一致性/文字准确性/其他）。
- 合规规则知识库位于 `apps/server/src/main/resources/compliance-rules/`；platform 规则注入质检提示词，market 规则仅保留知识库与来源展示（2026-09-08 起市场广告法退出判定）；缺失文件回退内置文案并告警，五图生成风格规则暂留代码。
- `POST /api/detail-page`：独立 AI 详情页自动化（不依赖五图流水线）：名称/卖点 + 平台多选 + 语气 → 画像 + 按平台 AI 组合配图引用与文案（`generatedTypes` 传已有生成图类型供引用）；AI 编排失败降级模板。供侧栏「AI 详情页」工作台调用。

完整接入方式见 `docs/integration-guide.md`，运维见 `docs/runbook.md`，架构见 `docs/architecture.md`。

## 核心业务概念

- **五图类型**：白底图、场景图、模特图、对比图、尺寸图（常量 `IMAGE_TYPES`，`apps/server/src/main/java/com/onelaunch/ImagePipelineService.java`）。
- **平台策略**：每个目标平台均生成全部五图（10 图 = 平台数 × 5）；提示词按「平台 × 图类」注入 20 组差异化风格与合规规则（`platformRule`），多平台出图互不雷同、贴合各平台自身特色。
- **降级策略**：画像失败降级纯文本，详情页失败降级模板；`qa-scope=all` 默认检测全部五类图，`white` 为白底兼容路径。未通过且有修复提示词的图自动进入修复回流（最多 2 轮，修复参考图 `[当前图, P3]`，白底/对比图修复后做背景纯白化兜底）；白底图修复轮用尽后另有文生图重制兜底；仍失败保留结果并提示到单图工作台。视觉调用/解析失败降级人工复检，不标为审核通过。规则文件启动加载到内存，缺失/空文件告警并用通用文案兜底，SSE 日志注明来源。
- **白底判定容差（踩坑警示，改检测提示词必须保留）**：AI 生成图的"纯白"实际为 RGB 245–254 带轻微压缩噪点，检测端苛求 RGB 255 会把正常噪点判"高噪点"，修复循环永不收敛；`ModelRouterVisionClient` 检测提示词已注入容差（各通道 ≥245 且均匀干净即合规，轻微噪点/极浅渐变不算违规），生成端 `editFromSourcePrompt` 仍要求完全重绘背景，两端容差必须匹配。
- **工具工作台后台运行**：前端单图工具工作台实例常驻挂载、切换仅隐藏（`App.tsx` 的 `toolPages`/`toolPage`），生成中切走不打断任务；单图工具生成五类图后自动调 `/api/compliance-check` 复检（带锚点参考图做 P3 本体检验）并支持一键按修复指令再生成；生成工作台槽位「重新生成/修改」成功后同样自动复检。不得改回 `tab === 'tool'` 条件挂载（会中断运行中的任务）。
- **角色分工**：画像 Agent → 提示词 Agent → 生成工具 → 质检 Agent → 合规 Agent → 详情页 Agent；五个职责角色由 Spring Boot 编排，提示词角色使用模板与画像，不额外调用 LLM，质检/合规在 all 模式共用一次视觉调用。
- **P3 本体检验（2026-09-08）**：P3 = 用户原始商品参考图（首张），是商品本体唯一真实性基准。质检时与待检图一起传入视觉模型（合并一次调用），输出平台合规 + 商品本体一致性（形状/结构/颜色/材质/比例/固有印刷一致、无新增装饰、无部件缺失）两项结论；背景差异不算问题（背景按图类重绘）。五图流水线每图、单图工具复检、槽位重生成复检三个触发点同口径；修复轮参考图为 `[当前图, P3]`（当前图为编辑基准、P3 为商品身份锚点，其背景不得采用防瓷砖回流）。生成端与质检端的商品本体约束必须保持同口径（`referenceConstraintBlock` 共享方法）。

## 代码规范

- TypeScript strict 模式；避免 `any`。
- Jackson 3：后端统一 `import tools.jackson.databind.JsonNode`（不是 `com.fasterxml.jackson`）。
- 模型 ID 集中在 `apps/server/src/main/resources/application.yml` 管理，禁止散落硬编码。
- 错误处理：对 Model Router 返回的 4xx/5xx 给出可读提示，不吞异常。
- 走 `.formatted()` 的提示词模板中所有字面 `%` 必须写成 `%%`（如 `85%%`）；漏写会在运行时抛 `Conversion` 异常，导致对应端点全量 400。
- 发给图片编辑模型的包装提示词不得包含与用户修改指令冲突的保持性约束（如指令要求移除文字时不得同时要求「固有标识不变」），冲突会让模型整体重绘；`suggestedPrompt` 必须是可直接执行的祈使句修复指令，不得写成审核说明。
- 提交信息遵循 Conventional Commits（feat/fix/docs/refactor 等）。
- 新增功能前先对照 `README.md` 硬性要求自检，不得偏离图片生成方向。
