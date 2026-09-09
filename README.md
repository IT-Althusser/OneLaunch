# OneLaunch · 一键出海 — 跨境 AI 商品图片生成工作台

> **复赛定位**：OneLaunch 为跨境卖家解决商品图制作慢、贵、不合规和多市场适配难的问题，把单 SKU 从资料到多平台上架图包的生产压缩到分钟级。
> 参赛场景一「AI 智能上新」，主选方向 1「AI 商品图片生成」。

| 大赛方向 | 状态 | 已覆盖能力 |
|---|---|---|
| 1. AI 商品图片生成（主选） | ✅ 已完成 | 白底/场景/模特/对比/尺寸五图；四平台差异化规则 |
| 2. AI 详情页自动化 | ✅ 已完成 | `/api/detail-page` 详情页工作台 |
| 3. AI 图片本地化 | ✅ 已完成 | `/api/images/localize`，场景/文字/模特三维度，五个目标市场 |
| 4. AI Listing 写作 | ❌ 未实现 | 列入后续迭代计划 |
| 5. AI 商品图跨境合规检测 | ✅ 已完成 | 五图合规检测、规则知识库、结构化修改建议、白底图自动重试、`/api/compliance-check` |

---

## 一、硬性要求（所有开发与文档不得违反）

### 1. 场景约束（不得偏离）

- 必须围绕场景一核心任务：**从选品到上架的自动化，数天 → 分钟级**。
- 本方案只做场景一给定的需求方向之一：**AI 商品图片生成**：
  - 自动生成五类上架必备图片：**白底图、场景图、模特图、对比图、尺寸图**；
  - **适配多平台尺寸和风格要求**（Amazon、TikTok Shop、Temu、Shopee 规范矩阵内置）；
  - 扩展能力：图片本地化（替换背景场景、文字语言、模特形象，适配区域市场审美）。
- 跨境为主：目标平台以 **Amazon、TikTok Shop** 为主，兼顾 **Temu、Shopee**。

### 2. API 约束（必须使用）

- 算力平台：**阿里云百炼**，通过 **Model Router API** 一站式调用模型（调用重点见【附录 A】，完整 126 模型清单与接口细节见同目录 `ModelRouter_API.docx`）。
- Base URL：`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`（Token Plan 专属）
- 认证方式：`Authorization: Bearer <your-api-key>`（API Key 算力审核通过后发放；代码中走环境变量 `MODEL_ROUTER_API_KEY`，禁止硬编码）
- 请求头：`Content-Type: application/json`
- **所有模型调用必须走 Model Router API，不得直连其他渠道。**
- 本方案调用的模型（均出自大赛 126 模型清单，且经 Token Plan `GET /v1/models` 实测确认可用）：

| 环节 | 模型 ID | 用途 |
|---|---|---|
| 商品画像 / 提示词设计 | `qwen3.7-max` | 构建商品画像，为五类图片设计生成提示词，融入平台风格要求 |
| 五图生成 | `wan2.7-image-pro` | 白底图/场景图/模特图/对比图/尺寸图生成（`/chat/completions` 多模态调用，同步返回） |
| 图片本地化替换 | `qwen-image-2.0` | 背景/场景编辑（`/chat/completions` 图生图，同步返回） |
| 白底图质检 | `qwen3.6-plus` | 视觉模型自动质检（内容理解与合规检测：白底合规/商品完整/水印与违规元素），未通过项列明细 |

> 说明（2026-08-30 更新）：Token Plan 可用模型清单实测共 23 个，**清单中不含 `qwen3-vl` 等显式视觉模型名**，但实测文本档的 `qwen3.6-plus` / `qwen3.6-flash`（126 清单内）实为多模态视觉模型（OpenAI 嵌套 `image_url` 格式传图，实测通过），白底图质检由「人工复检提醒」升级为**视觉模型自动质检**（调用失败仍降级人工复检）；文档级 `ModelRouter_API.docx` 中的 `qwen/` 前缀模型名与异步调用方式在 Token Plan 网关均不可用，实际调用格式见【附录 A.3】。

- 调用方式遵循官方 Tips：多模型组合调用（商品画像 → 提示词设计 → 图片生成 → 视觉质检）。大赛要求产品展示场景流式输出，但 Token Plan 网关实测仅支持同步调用（含图片能力），故本项目全部为同步调用。

### 3. 交付物约束

- 复赛作品按 Word 模板填写并转 PDF 提交，文件名：`团队名_方案名称_复赛作品.pdf`，截止日期：2026-09-15。
- 代码上传 GitCode，可使用私有仓库，并为评审账号 `air__Heaven` 授权访问。
- 演示视频上传 B 站或 CSDN，时长 3-5 分钟；体验地址、可运行 Demo 与其他提交物见「复赛提交物清单」。

### 4. 输出目录约束

- 本方案所有产出文件统一放在：`D:\Java\code\vibe coding\ONE`

### 5. 项目工程文件（技术栈与命令以 CLAUDE.md 为准）

| 文件 | 说明 |
|---|---|
| `CLAUDE.md` | 项目规则、技术栈、目录结构、常用命令（AI/开发者进入仓库先读） |
| `package.json` | 根脚本（前端 npm + 后端 Maven） |
| `apps/web/package.json` | 前端：React 18 + TypeScript + Vite + Tailwind CSS |
| `apps/server/pom.xml` | 后端：Java 25 + Spring Boot 4.0 + Spring AI 2.0.1（Maven） |

---

## 产品功能全景

1. **五图流水线实时过程流**：通过 `/api/images/set/stream` 以 SSE 展示画像、提示词、生成、质检、合规和详情页步骤。
2. **参考图生成**：`/api/images/set`、`/api/images/single` 支持最多 6 张参考图。
3. **白底图质检与自动重试**：视觉质检失败且有修复提示时自动重生成一次；白底判定内置容差（各 RGB 通道 ≥245 且均匀干净即合规，轻微压缩噪点不算违规）。
4. **全图类跨境合规检测**：`/api/compliance-check` 覆盖五类图，输出平台规范、市场广告法、文字准确性问题与建议；`MODEL_ROUTER_QA_SCOPE` 可切换 `all`/`white`。
5. **多平台差异化出图**：按 Amazon、TikTok Shop、Temu、Shopee 与图类组合生成平台适配图。
6. **图片本地化三维度**：`/api/images/localize` 支持背景场景、文字语言、模特形象。
7. **单图工具工作台七工具**：白底、场景、模特、对比、尺寸、本地化、合规检测；生成任务后台运行（切换工作台不打断），五类图生成后自动合规复检，未通过可一键按修复指令再生成。
8. **AI 详情页工作台**：`/api/detail-page` 生成详情页草稿。
9. **模型按请求覆盖**：支持 `imageModel`、`editModel`、`textModel`、`visionModel` 覆盖默认模型。

默认 `MODEL_ROUTER_QA_SCOPE=all`：逐图核对平台、市场规则与原始商品资料。白底、场景、模特、对比图未通过时最多修复一次；尺寸图由商品原图和明确提供的尺寸确定性排版，缺失参数不填数字，审核失败不交给模型重画文字。已审核通过的白底图用于后续生成，分别记录首次通过和修复后通过。`white` 保留为仅检查白底的兼容模式。实际用时以工作台计时为准。

## 业务价值

目标用户是需要在多个海外平台快速上新的中小跨境卖家、品牌团队和代运营团队。传统流程存在制作成本高、制作周期长、平台主图规范复杂、多平台重复返工，以及不同市场对背景、模特和文字偏好不同五类问题。

完整链路是：创作页填写商品资料并上传参考图，画像 Agent 提炼商品信息，提示词 Agent 按平台和图类组装提示词，生成工具产出五图；质检 Agent 与合规 Agent 检查图片并给出结构化建议，详情页 Agent 编排详情页草稿；用户可在单图工作台按建议修复，再用本地化三维度生成区域版本，最终得到多平台图片与详情页素材。

预期将新品图片制作从 **1–3 天压缩到 5 分钟内**，让外包成本降低 **80%+**，并通过质检与合规自动拦截降低拒登风险。

## 技术架构

数据流：`React/Vite → Spring Boot ImagePipelineService → 画像 Agent → 提示词 Agent → 图片生成工具 → 质检 Agent → 合规 Agent → 详情页 Agent → SSE/REST`。系统采用事件驱动流水线，不依赖独立 Agent 框架，所有调用同步走 Model Router `/chat/completions`。

| 角色/工具 | 模型 | 职责 | 失败降级 |
|---|---|---|---|
| 画像 Agent | qwen3.7-max | 构建商品画像 | 纯文本拼接 |
| 提示词 Agent | 代码模板 + qwen3.7-max 输出的画像 | 按平台×图类组装提示词，不额外发起 LLM 请求 | 使用可用画像与模板继续 |
| 图片生成工具 | wan2.7-image-pro | 五类文生图（白底/对比图优先确定性像素直出） | 单图失败不阻断；直出失败回退模型生成 |
| 图片编辑工具 | qwen-image-2.0 | 本地化图生图、修复回流 | 返回可读错误 |
| 质检 Agent | qwen3.6-plus | 五类图视觉质检 + P3 商品本体一致性检验 | 人工复检提醒 |
| 合规 Agent | qwen3.6-plus + ComplianceRuleLibrary | 平台规范与图类要求、文字准确性检测（市场广告法仅知识库展示） | 规则回退或人工复检 |
| 详情页 Agent | qwen3.7-max | 编排详情页 | 模板降级 |

图片生成/编辑使用扁平 `image` 图片 part，视觉理解使用嵌套 `image_url`；文生图由网关返回 2048×2048，图生图返回 1024×1024，画幅由前端裁切。详细流程见 `docs/architecture.md`。

五个 Agent 是流水线中的职责角色，并非五个独立模型实例：提示词角色由模板实现；`all` 模式下质检与合规共用每图一次视觉调用。SSE 流式展示应用事件，网关模型调用保持同步。人工复检不会标为审核通过；结构化建议是风险筛查结果，不构成法律意见。

### 规则知识库

合规规则位于 `apps/server/src/main/resources/compliance-rules/`：`platform/` 下 4 个文件、`market/` 下 5 个文件。新增平台或市场只需增加规则文件，缺失文件自动回退内置文案并告警。五图生成的风格规则暂留 `ImagePipelineService` 代码，后续统一入库；进一步计划构建规则与案例向量知识库，引入 RAG 检索增强合规检测。

## 快速开始

环境要求：Node ≥20、JDK 25、Maven。

```powershell
cd "D:\Java\code\vibe coding\ONE"
npm install
if (!(Test-Path apps/server/.env)) { Copy-Item apps/server/.env.example apps/server/.env }
# 编辑 apps/server/.env，填写 MODEL_ROUTER_API_KEY
npm run dev:server
```

另开终端运行前端：

```powershell
npm run dev:web
```

后端地址 `http://localhost:3101`，前端地址 `http://localhost:5173`。进入创作页填写商品资料并上传参考图，在生成工作台观察「画像 Agent → 提示词 Agent → 生成工具 → 质检 Agent → 合规 Agent → 详情页 Agent」思考日志；随后查看合规结果面板，在单图工作台修复图片，使用本地化工具生成区域版本，并打开 AI 详情页工作台。

<!-- TODO: 截图：创作工作台填写商品资料与参考图 -->
<!-- TODO: 截图：生成过程流与多智能体日志 -->
<!-- TODO: 截图：合规结果面板与结构化修改建议 -->

## 开发阶段成果与迭代计划

已完成：五图流水线、多平台差异化出图、图片本地化三维度、全图类合规检测、合规规则知识库文件化、多智能体日志与步骤显性化、AI 详情页自动化、单图七工具工作台，以及网关自产图冒烟验证。

实测挑战与解决：`/v1/images/generations` 返回 400 `url error`，改走 `/chat/completions`；异步调用返回 403，统一全同步；图片生成模型与视觉模型的 content 格式相反，分别封装；图片尺寸由网关决定，前端负责裁切；Wikimedia 图片触发 `Download multimodal file timed out`，改用网关自产图完成验证。

后续计划：接入阿里云 OSS 保存任务、图片、审核结果和历史版本，支持按 SKU/平台/市场检索与恢复；增加商品视频生成，基于已审核图片和商品卖点生成短视频分镜、口播/字幕草稿及平台比例版本，并保留人工审核；同时实现 AI Listing 写作、统一生成风格与合规规则管理、建设向量知识库与 RAG 检索增强合规检测，持续扩充合规规则库。

## 复赛提交物清单

- 复赛作品 PDF：`团队名_方案名称_复赛作品.pdf`
- GitCode 仓库地址：<!-- TODO: GitCode 仓库地址 -->（私有仓库需授权评审账号 `air__Heaven`）
- 演示视频链接：<!-- TODO: 演示视频链接 -->
- 体验地址：<!-- TODO: 体验地址 -->

---

## 附录 A：Model Router API 调用重点（完整文档见 ModelRouter_API.docx）

### A.1 基础信息

- Base URL: `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- 认证: Bearer Token（API Key）；公共请求头 `Authorization: Bearer <your-api-key>`、`Content-Type: application/json`

### A.2 本方案用到的模型分类

| 类别 | 模型 | 本方案用途 |
|---|---|---|
| 文本对话 | qwen3.7-max | 商品画像、五图提示词设计 |
| 图片生成 | wan2.7-image-pro | 五图生成（`/chat/completions` 多模态，同步） |
| 图片编辑 | qwen-image-2.0 | 本地化替换（`/chat/completions` 图生图，同步） |
| 视觉理解 | qwen3.6-plus | 白底图质检（内容理解与合规检测，`/chat/completions` 传图，同步） |

### A.3 接口要点（Token Plan 实测验证）

Token Plan 网关上所有能力统一走 `POST /v1/chat/completions`（同步），图片能力不使用 `/v1/images/generations`：

| 能力 | 模型 | 请求 content | 响应取值 |
|---|---|---|---|
| 文本对话 | qwen3.7-max | 纯字符串 | `choices[0].message.content` |
| 文生图 | wan2.7-image-pro | `[{type:"text", text:"..."}]` | `output.choices[0].message.content[].image` |
| 图生图 | qwen-image-2.0 | `[{type:"image", image:"<url>"},{type:"text", text:"..."}]` | 同上 |
| 视觉理解（质检） | qwen3.6-plus | `[{type:"image_url", image_url:{url:"<url>"}},{type:"text", text:"..."}]`（OpenAI 嵌套格式，可传 base64 data URL） | `choices[0].message.content`（建议 `"enable_thinking": false` 关闭思维链） |

调用示例（文生图，完整封装见 `ModelRouterImageClient.java`）：

```bash
  curl https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-xxx" \
  -d '{ "model": "wan2.7-image-pro",
       "messages": [{ "role": "user",
         "content": [{ "type": "text",
           "text": "纯白背景电商主图，轻量通勤托特包，商品占画面 85% 以上" }] }] }'
```

实测不可用（与 docx 文档存在差异，勿按文档原样调用）：
- `POST /v1/images/generations` → 400 `url error`；
- `X-DashScope-Async: enable` 异步 → 403（该 Key 不支持异步调用）；
- 图片**生成/编辑**模型（wan2.7-image-pro、qwen-image-2.0 等）用 OpenAI `image_url` 嵌套格式传图 → 400（这两类模型的图片 part 必须是 `type=image` + `image=url` 扁平字段）。

实测可用（2026-08-30 补充）：图生图 `image` 字段同时接受公网 URL 与 `data:image/...;base64`（本地图片直传），且单次调用可传多张参考图（上限 6）；网关模型清单以 `GET /v1/models` 实时为准（当前 23 个，图片模型 4 个：wan2.7-image、wan2.7-image-pro、qwen-image-2.0、qwen-image-2.0-pro）。**视觉能力与清单表现不同**：清单无 `vl` 字样模型，但文本档 `qwen3.6-plus` / `qwen3.6-flash` 实测为多模态视觉模型（嵌套 `image_url` 传图 + base64 均可用，图片宽高须大于 10px，单图最高 1600 万像素）。

### A.4 常见问题速查

| 问题 | 解决 |
|---|---|
| 图片生成报 "url error" | Token Plan 的 `/images/generations` 不可用，改走 `/chat/completions` 多模态调用（本方案已实现） |
| 异步调用 403 | Token Plan Key 不支持异步，本地化改为同步图生图（本方案已实现） |
| 图文混合 content 报错 | 图片生成/编辑模型用 `{type:"image", image:url}` 扁平字段；视觉理解模型（qwen3.6-plus 等）用 `{type:"image_url", image_url:{url}}` 嵌套格式 |
| 图片宽高校验失败 | 视觉理解要求图片宽高大于 10px（1×1 测试图会报 `must be larger than 10`） |
| qwq 调用失败 | 设置 `"stream": true`（本方案未使用 qwq） |
| 401 / 鉴权失败 | 检查 `Authorization: Bearer <api-key>` 与环境变量配置 |
| `model_not_found` | 用 `GET /v1/models` 查询 Token Plan 实际可用模型名（不带 `qwen/` 前缀） |

### A.5 当前接口状态

文本对话、文生图、图生图（本地化）、视觉质检四种能力均已在后端跑通端到端测试（真实图片 URL 返回；E2E 中视觉质检真实拦截了一张印有平台名称的违规白底图并给出原因）。图片生成尺寸由网关决定（文生图 2048×2048，图生图 1024×1024），暂不支持请求参数指定。白底图质检由视觉模型 `qwen3.6-plus` 自动执行，调用或解析失败时降级为人工复检提醒。
