# OneLaunch · 一键出海 — 跨境 AI 商品图片生成工作台

> 参赛场景：场景一「AI 智能上新」
> 核心任务：用 AI 实现从选品到上架的自动化，将新品上架流程从数天压缩至分钟级。
> 选定需求方向：**AI 商品图片生成** — 自动生成白底图、场景图、模特图、对比图、尺寸图，适配多平台尺寸和风格要求。

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

- 初赛通过**在线表单**提交，无需 Word/PDF。表单字段：
  - 基本信息：团队名称、队长信息、参赛场景（场景一）
  - 方案名称
  - 方案概述：解决的问题、目标用户与业务痛点、3-5 项核心功能、方案亮点及预期效果
  - 技术方案：拟使用的模型或能力、AI Agent 或工作流、数据处理方式、前后端及其他技术组件
  - 附加材料（选填）：产品原型、流程图、架构图、演示视频、测试截图；代码仓库地址
- **代码最终上传 GitHub。**

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

## 二、方案定位（一句话）

面向跨境卖家的 AI 商品图片生成工作台：输入商品名称与卖点，分钟级自动产出「白底图 / 场景图 / 模特图 / 对比图 / 尺寸图」的多平台上架图包，覆盖 Amazon / TikTok Shop / Temu / Shopee 的风格规范。

## 三、交付物清单

| 文件 | 说明 |
|---|---|
| `README.md` | 本文件：硬性要求 + Model Router API 调用重点 |
| `CLAUDE.md` | 项目规则 / 技术栈 / 命令 |
| `package.json`、`apps/*/package.json` | 工程配置 |
| `提交内容_方案概述与技术方案.md` | 表单填写版文案（方案名称/概述/技术方案） |
| `附加材料_架构图.html` | 技术架构图（浏览器打开可截图上传） |
| `附加材料_业务流程图.html` | 五图生成流水线流程图 |
| `附加材料_产品原型.html` | 图片生成工作台产品原型（可交互 mockup） |
| `ModelRouter_API.docx` | 大赛 API 完整文档（原始件） |
| `docs/` | API 接入、架构、运维与变更记录 |

## 四、评审标准对照（设计自检）

- 业务价值：图片制作降本（外包成本降 80%+）+ 提效（1-3 天 → 分钟级）+ 避损（白底图视觉质检自动拦截违规图并给出原因，降低拒登率）。
- 创新性：「画像先生成 + 视觉质检自动复检」的图片生产流水线；平台风格内置提示词模板，新增平台只加一条模板。
- 可行性：全部能力映射到 Token Plan 实测可用模型（qwen3.7-max / wan2.7-image-pro / qwen-image-2.0 / qwen3.6-plus），端到端跑通并返回真实图片 URL。
- 技术思路：Spring Boot 编排服务统一调度商品画像 / 提示词组装 / 五图生成 / 视觉质检；文本、图片与视觉理解能力统一走 `/chat/completions` 同步链路，简单可靠。

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
