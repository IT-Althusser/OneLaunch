# OneLaunch API 接入指南

## 本地服务

- 前端开发服务器：`http://localhost:5173`
- 后端 API：`http://localhost:3100`（Java 25 + Spring Boot 4.0.6 + Spring AI 2.0.1）
- 健康检查：`GET /api/health`

后端通过 `apps/server/.env` 读取 `MODEL_ROUTER_API_KEY`、`MODEL_ROUTER_BASE_URL`、模型 ID 与 `PORT`。密钥只放环境变量，不要写入源码或文档。

## 业务接口

### 生成五图与详情页（同步）

`POST /api/images/set`

```json
{
  "productName": "轻量通勤托特包",
  "sellingPoints": "防泼水、可装 15 寸笔记本、自重 380g",
  "platforms": ["Amazon", "TikTok Shop"],
  "detailTone": "专业可信",
  "referenceImages": ["https://example.com/product.jpg", "data:image/jpeg;base64,..."],
  "imageModel": "wan2.7-image-pro",
  "editModel": "qwen-image-2.0",
  "textModel": "qwen3.7-max"
}
```

返回 `steps`、`profile`、`images`、`qa` 与 `detailPages`。**每个平台都生成完整五图**，提示词按「平台 × 图类」差异化（每平台独有风格与合规规则，多平台不雷同）；图片调用次数 = 平台数 × 5，白底图每平台各质检一次。`detailTone` 可选（专业可信 / 种草转化 / 简洁高端），影响详情页草稿的标题与文案基调。

- `referenceImages`（可选，最多 6 张）：公网 URL 或本地图 base64 data URL（实测网关支持，且单次可传多张）。有参考图时五图走图生图，与商品外观保持一致。
- `imageModel` / `editModel` / `textModel`（可选）：覆盖默认模型 ID。
- 校验：`productName` 与 `referenceImages` 至少提供一个；有参考图时 `sellingPoints` 可留空。

### 生成五图与详情页（SSE 流式，前端主流程）

`POST /api/images/set/stream`，请求体同上。响应为 `text/event-stream`，逐条推送：

| 事件 | 负载 | 说明 |
|---|---|---|
| `log` | `{text}` | 思考过程文字（阶段进度、成功/失败摘要） |
| `profile` | `{text}` | 商品画像文本 |
| `image_start` | `{type, platform, prompt}` | 单图开始生成（含本次提示词） |
| `image_done` | `{type, platform, size, url, prompt}` | 单图完成 |
| `image_fail` | `{type, platform, error}` | 单图失败（含网关错误信息） |
| `qa` | 单条 `QaRecord` | 单图审核完成，含 platform；同平台同图类复检覆盖前一次记录 |
| `done` | 完整 `ImagePipelineResponse` | 任务结束 |
| `fatal` | `{error}` | 流程级异常 |

质检记录 `qa[]`：`type/url/passed/comment` 与 `issues: string[]` 保持兼容，`model` 为审核模型，`market/platform` 标记归属，`complianceIssues` 为 `{dimension,severity,detail,suggestion}[]`，`suggestedPrompt` 为中文修复建议。演示默认 `MODEL_ROUTER_QA_SCOPE=white`（每平台仅白底图质检）；设置 `MODEL_ROUTER_QA_SCOPE=all` 后为完整模式（每平台五次初检）；`white` 仅每平台一次白底兼容质检，不含市场广告法。两种模式下白底图未通过且有建议均自动重试一次、按相同模式二次审核，其余图不自动重生成。人工复检保留旧 passed=true，但 model=null，客户端必须显示待复检而非通过；白底兼容路径的 complianceIssues 为空数组，使用 issues 文本列表。

### 模型清单

`GET /api/models`：实时拉取网关 `GET /v1/models` 并按能力分组：`textToImage` / `imageToImage` / `text` / `vision` / `other`，每项 `{id, verified}`；`visionAvailable` 取决于清单中是否存在实测具备视觉理解能力的模型（当前为 `qwen3.6-plus` / `qwen3.6-flash`，`/v1/models` 清单本身不体现视觉能力）。

### 图片代理

`GET /api/image-proxy?url=<https 图片地址>&download=false`：同源拉取网关返回的图片；`download=true` 时带 `Content-Disposition: attachment`。仅允许 http(s) 地址。前端单图工作台的画幅裁切（canvas 需同源像素）与下载原图依赖此端点。

### 单图重生成 / 参考图生成 / 基于已生成图修改

`POST /api/images/single`，同步返回 `{ image: GeneratedImage }`。三分支：

- 仅 `type` + `prompt`（可选 `model`）：文生图重生成；
- + `referenceImages`：参考图生成（图生图，默认走 `editModel`）；
- + `sourceUrl`：基于已生成图修改（图生图，源图 + 指令）。

### 图片本地化

`POST /api/images/localize` 支持 `sourceUrl`、`targetMarket`、`instruction`、`aspects`、`targetLanguage`、`modelProfile`，返回 `{ image, appliedAspects, note, prompt }`。

aspects 省略默认 `["scene"]`，显式空数组或非法值返回 400。目标市场默认 US；目标语言未指定时日本→日语，其余→英语。instruction 为可选附加要求，text 生效返回文字人工复核 note，modelProfile 仅在 model 生效时使用；sourceUrl 必须是 http(s) 或图片 data URL，model 可覆盖默认编辑模型。

`POST /api/compliance-check` 请求 `{imageUrl,imageType?,platform,market,visionModel?}`，返回 `passed`、`summary`、`issues`、`complianceIssues`、`suggestedPrompt`、`model`；图片支持公网 URL 或 `data:image/...;base64`，缺少必要参数返回可读 400。

imageType 省略默认白底图；平台与市场必填。结构化问题位于 complianceIssues，issues 是兼容文本列表；summary 含“AI 辅助审查，不构成法律意见”。独立检测失败返回可读错误供用户重试，流水线检测失败则输出人工复检记录并继续。

### AI 详情页自动化（独立，不依赖五图流水线）

`POST /api/detail-page`，参数为 `productName`、`sellingPoints`（至少其一）、`platforms`（多选，默认 Amazon）、`detailTone`（可选）、`generatedTypes`（可选，已有生成图的类型集合，供 AI 引用配图）、`textModel`（可选）。返回 `{ detailPages: DetailPage[] }`，结构同流水线 `done` 事件中的 `detailPages`。内部先构建商品画像（失败降级纯文本拼接），再逐平台复用流水线的 AI 编排（失败降级模板）；供侧栏「AI 详情页」工作台直接调用——无需先跑五图即可输入卖点生成详情页，已有生成图时模块自动引用配图。

## Model Router

请求基地址使用 Token Plan 专属地址：
`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`

服务端统一调用 `POST /chat/completions`，自动附加 `Authorization: Bearer <MODEL_ROUTER_API_KEY>`，并提供超时与错误解析：

| 能力 | 默认模型 | 可选模型（2026-08-30 实测） | content 格式 | 响应取值 |
|---|---|---|---|---|
| 文本对话（商品画像） | `qwen3.7-max` | qwen3.8-max、deepseek/glm/kimi 等 16 个文本模型 | 纯字符串 | `choices[0].message.content` |
| 文生图（五图生成） | `wan2.7-image-pro` | `wan2.7-image` | `[{type:"text", text}]` | `output.choices[0].message.content[].image` |
| 图生图（参考图/编辑/本地化） | `qwen-image-2.0` | `qwen-image-2.0-pro` | `[{type:"image", image:url 或 base64}, ...]` | 同上 |
| 视觉理解（白底图质检） | `qwen3.6-plus` | `qwen3.6-flash` | `[{type:"image_url", image_url:{url:url 或 base64}}, {type:"text", text}]`（嵌套格式） | `choices[0].message.content`（`"enable_thinking": false` 时为纯答案） |

封装位置：文本走 `TokenPlanChatModel`（Spring AI ChatModel 实现，支持按请求覆盖模型），图片走 `ModelRouterImageClient.java`，视觉质检走 `ModelRouterVisionClient.java`（模型限 126 清单内实测具备视觉能力者）。

## 已知限制（Token Plan 实测）

- `POST /images/generations` 返回 400 `url error`，不可用；
- `X-DashScope-Async: enable` 异步调用被 403 拒绝，因此**没有异步任务接口**，本地化与参考图生成为同步图生图；
- 图片**生成/编辑**模型的图片 part 必须用 `{type:"image", image:url}` 扁平字段（嵌套 `image_url` 返回 400）；**视觉理解模型相反**，必须用 `{type:"image_url", image_url:{url}}` 嵌套格式（URL 与 `data:image/...;base64` 均可，图片宽高须大于 10px）；图生图 `image` 字段单次可传多张（上限 6）；
- Token Plan 模型清单（`GET /v1/models`，2026-08-30 实测 23 个）无 `vl` 字样模型，但文本档 `qwen3.6-plus` / `qwen3.6-flash`（126 清单内）实测为多模态视觉模型；`qwen3.7-max` 确认纯文本；白底图质检走 `qwen3.6-plus` 视觉质检，失败降级人工复检提示；
- 图片尺寸由网关决定（文生图 2048×2048，图生图 1024×1024）；2026-08-30 复测：`chat/completions` 请求带 `size` 参数被网关静默忽略（仍返回默认尺寸），多平台投放画幅由前端单图工作台按 1:1 / 3:2 / 2:3 居中裁切输出。

