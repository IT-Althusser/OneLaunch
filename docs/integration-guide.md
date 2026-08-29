# OneLaunch API 接入指南

## 本地服务

- 前端开发服务器：`http://localhost:5173`
- 后端 API：`http://localhost:3100`（Java 25 + Spring Boot 4.0.6 + Spring AI 2.0.1）
- 健康检查：`GET /api/health`

后端通过 `apps/server/.env` 读取 `MODEL_ROUTER_API_KEY`、`MODEL_ROUTER_BASE_URL`、模型 ID 与 `PORT`。密钥只放环境变量，不要写入源码或文档。

## 业务接口

### 生成五图与详情页

`POST /api/images/set`

```json
{
  "productName": "轻量通勤托特包",
  "sellingPoints": "防泼水、可装 15 寸笔记本、自重 380g",
  "platforms": ["Amazon", "TikTok Shop"],
  "referenceImageUrl": "https://example.com/product.jpg",
  "detailTone": "专业可信"
}
```

返回 `steps`、`profile`、`images`、`qa` 与 `detailPages`。首个平台生成全部五图，其余平台生成白底主图。

### 单图重生成

`POST /api/images/single`，参数为 `type`、`prompt`，可选 `platform`，同步返回 `{ image: GeneratedImage }`。

### 图片本地化

`POST /api/images/localize`，参数为 `sourceUrl`、`targetMarket`、`instruction`，同步执行图生图编辑，返回 `{ image: GeneratedImage }`（type 为 `本地化图`）。

## Model Router

请求基地址使用 Token Plan 专属地址：
`https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`

服务端统一调用 `POST /chat/completions`，自动附加 `Authorization: Bearer <MODEL_ROUTER_API_KEY>`，并提供超时与错误解析：

| 能力 | 模型 | content 格式 | 响应取值 |
|---|---|---|---|
| 文本对话（商品画像） | `qwen3.7-max` | 纯字符串 | `choices[0].message.content` |
| 文生图（五图生成） | `wan2.7-image-pro` | `[{type:"text", text}]` | `output.choices[0].message.content[].image` |
| 图生图（本地化） | `qwen-image-2.0` | `[{type:"image", image:url}, {type:"text", text}]` | 同上 |

封装位置：文本走 `TokenPlanChatModel`（Spring AI ChatModel 实现），图片走 `apps/server/src/main/java/com/onelaunch/ModelRouterImageClient.java`。

## 已知限制（Token Plan 实测）

- `POST /images/generations` 返回 400 `url error`，不可用；
- `X-DashScope-Async: enable` 异步调用被 403 拒绝，因此**没有异步任务接口**（`/api/tasks/:taskId` 已移除），本地化为同步图生图；
- 图片 part 必须用 `{type:"image", image:url}` 扁平字段，OpenAI 的 `image_url` 嵌套格式返回 400；
- Token Plan 模型清单（`GET /v1/models`，共 24 个）不含 VL 视觉模型，质检降级为人工复检提示；
- 图片尺寸由网关决定（文生图 2048×2048，图生图 1024×1024），暂不支持请求参数指定。
