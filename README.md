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
- Base URL：`https://model-router.edu-aliyun.com/v1`
- 认证方式：`Authorization: Bearer <your-api-key>`（API Key 算力审核通过后发放；代码中走环境变量 `MODEL_ROUTER_API_KEY`，禁止硬编码）
- 请求头：`Content-Type: application/json`
- **所有模型调用必须走 Model Router API，不得直连其他渠道。**
- 本方案拟调用的模型（均出自大赛 126 模型清单）：

| 环节 | 模型 ID | 用途 |
|---|---|---|
| 提示词设计 / 场景策划 | `qwen/qwen3.7-max` | 为五类图片设计生成提示词，融入平台风格要求 |
| 商品图理解 / 质检精检 | `qwen/qwen3-vl-plus` | 参考图解析构建商品画像；生成图规范复检 |
| 批量质检粗筛 | `qwen/qwen3-vl-flash` | 低成本批量预筛，可疑图再交 plus 精检 |
| 五图生成 | `qwen/wan2.7-image-pro` | 白底图/场景图/模特图/对比图/尺寸图生成（同步调用） |
| 图片本地化替换 | `qwen/wan2.5-i2i-preview` | 背景/文字/模特形象替换（异步任务 + 轮询） |
| 原型验证小模型 | `qwen/qwen3.5-flash` | 按官方 Tips 先小模型验证再切高性能模型 |

- 调用方式遵循官方 Tips：多模型组合调用（视觉理解 → 提示词设计 → 图片生成 → 质检）；产品展示场景使用**流式**输出。

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
| `package.json` | workspaces 根配置（apps/web + apps/server） |
| `apps/web/package.json` | 前端：React 18 + TypeScript + Vite + Tailwind CSS |
| `apps/server/package.json` | 后端：Node.js ≥20 + Express + TypeScript |

---

## 二、方案定位（一句话）

面向跨境卖家的 AI 商品图片生成工作台：输入商品名称、卖点与可选参考图，分钟级自动产出「白底图 / 场景图 / 模特图 / 对比图 / 尺寸图」的多平台上架图包，覆盖 Amazon / TikTok Shop / Temu / Shopee 的尺寸与风格规范。

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

## 四、评审标准对照（设计自检）

- 业务价值：图片制作降本（外包成本降 80%+）+ 提效（1-3 天 → 分钟级）+ 避损（白底图规范质检，降低拒登率）。
- 创新性：「理解先生成 + 质检闭环」的图片生产流水线；平台规范配置矩阵，新增平台只加一条配置。
- 可行性：全部能力映射到 Model Router 现有模型（wan2.7-image-pro / qwen3-vl 系列 / qwen3.7-max），技术路线可落地。
- 技术思路：编排 Agent + 4 个专业子 Agent（商品图理解 / 提示词设计 / 图片生成 / 质检）；flash 粗筛 + plus/max 精检的模型分层降本策略。

---

## 附录 A：Model Router API 调用重点（完整文档见 ModelRouter_API.docx）

### A.1 基础信息

- Base URL: `https://model-router.edu-aliyun.com/v1`
- 认证: Bearer Token（API Key）；公共请求头 `Authorization: Bearer <your-api-key>`、`Content-Type: application/json`

### A.2 本方案用到的模型分类

| 类别 | 模型 | 本方案用途 |
|---|---|---|
| 文本对话 | qwen/qwen3.7-max、qwen/qwen3.5-flash | 五图提示词设计、场景策划；原型验证 |
| 视觉/多模态 | qwen/qwen3-vl-plus、qwen/qwen3-vl-flash | 商品图理解建画像；生成图质检精检/粗筛 |
| 图片生成/编辑 | qwen/wan2.7-image-pro、qwen/wan2.7-image、qwen/wan2.5-i2i-preview | 五图生成（同步）；本地化替换（异步） |

### A.3 接口要点（本方案相关）

| 接口 | 调用方式 | 关键点 |
|---|---|---|
| POST /v1/chat/completions | 同步/流式 | 兼容 OpenAI；视觉模型在 messages 传图（image_url）；产品展示用流式 |
| POST /v1/images/generations | 新版同步 / 旧版异步 | wan2.7/2.6 同步，直接返回图片 URL；wan2.5/2.2 需 `X-DashScope-Async: enable` + `input.prompt` 格式 |
| GET /v1/tasks/{task_id} | GET | 旧版图编辑模型（本地化替换）异步任务结果轮询 |

调用示例（图片生成，其余见 docx）：

```bash
curl https://model-router.edu-aliyun.com/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-xxx" \
  -d '{ "model": "qwen/wan2.7-image-pro",
       "prompt": "纯白背景电商主图，轻量通勤托特包，商品占画面 85% 以上",
       "size": "1024*1024" }'
```

### A.4 常见问题速查

| 问题 | 解决 |
|---|---|
| 图片生成报 "url error" | 旧版模型改异步：加 `X-DashScope-Async: enable`，用 `input.prompt` |
| qwq 调用失败 | 设置 `"stream": true`（本方案未使用 qwq） |
| 401 / 鉴权失败 | 检查 `Authorization: Bearer <api-key>` 与环境变量配置 |
