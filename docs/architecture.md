# OneLaunch 架构说明

## 数据流

```text
React/Vite → Spring Boot /api/images/set/stream（SSE，主流程；/api/images/set 为同步兼容）
  → 商品画像（文本模型，默认 qwen3.7-max，可按请求覆盖，/chat/completions 文本）
  → 平台化五图提示词
      ├─ 无参考图 → 文生图（wan2.7-image-pro，可覆盖）
      └─ 有参考图（URL 或 base64，≤6 张）→ 图生图（qwen-image-2.0，可覆盖，保持商品一致）
  → 每张图实时推送 image_start / image_done / image_fail 事件
  → 白底图视觉质检（qwen3.6-plus：内容理解与合规检测——白底合规/商品完整/水印与违规元素，输出结构化 JSON 含 issues 与修复提示词样例；未通过自动按样例重试一次并二次质检，失败降级人工复检提醒）
  → AI 详情页自动化：文本模型按平台规范（Amazon/TikTok/Temu/Shopee）组合画像+卖点+配图引用，输出结构化 JSON，失败降级模板
  → 前端：五图槽位四态（pending/running/done/failed）+ 思考日志台 + 单图工作台（参考素材/文字描述/画幅裁切）+ AI 详情页图文编排
```

## 组件职责

- `TokenPlanChatModel`：Model Router `/chat/completions` 的 Spring AI `ChatModel` 实现，商品画像等文本能力统一走 Spring AI ChatClient；请求带 `ChatOptions.model` 时按请求覆盖模型 ID。
- `ImagePipelineService`：流水线编排——商品画像、五图提示词、图片调用、质检记录、AI 详情页自动化（按平台规范组合配图引用与文案，解析失败降级模板）；核心 `run(request, emit)` 以事件回调驱动，同步端点静默消费事件，`runStream` 包装为 SseEmitter（虚拟线程执行）。另提供独立详情页生成 `generateDetailPages`（`POST /api/detail-page`，画像 + 逐平台编排 + 降级模板，与五图流水线解耦，共用 `profilePrompt` 与 `aiDetailPage`）。
- `ModelRouterImageClient`：图片能力封装——文生图与图生图（参考图/编辑/本地化）统一走 `/chat/completions` 多模态 content（Token Plan 实测格式），`image` 字段接受公网 URL 与 base64 data URL，支持多参考图（≤6）与模型覆盖；另提供 `listModels()`（GET /v1/models）与 `fetchImage()`（同源图片代理，供前端画幅裁切与下载）。
- `ModelRouterVisionClient`：视觉理解封装——白底图质检（内容理解与合规检测），用 OpenAI 嵌套 `image_url` 格式传图（URL/base64 均可）+ `enable_thinking:false`，输出结构化 JSON（passed/issues/summary/suggestedPrompt）解析为质检记录（未通过时样例驱动自动重试一次）；模型限 126 清单内实测具备视觉能力者（`qwen3.6-plus` 默认 / `qwen3.6-flash`），供 `GET /api/models` 的 `vision` 分组与 `visionAvailable` 判定。
- `HttpClientConfig`：统一 RestClient 超时（连接 10s，读取按 `model-router.timeout-seconds`，默认 120s）。

## 平台策略

每个目标平台均生成全部五类图片（图片调用次数 = 平台数 × 5）；提示词按「平台 × 图类」注入 20 组差异化规则（`platformRule`：每平台独有的构图、氛围与合规要求，如 TikTok 竖版抓拍感、Temu 参数直给、Shopee 移动端简洁、Amazon 专业棚拍），多平台图片组互不雷同。流水线逻辑集中在 `apps/server/src/main/java/com/onelaunch/ImagePipelineService.java`。

## 容错

任一步骤失败会记录到 `steps`、以 `image_fail`/`log` 事件推给前端并继续流水线；画像和详情页均有降级结果。商品画像失败降级为纯文本拼接；无文字信息且只有参考图时跳过画像直接按参考图生成；白底图视觉质检失败（调用/解析异常或网关暂无可用视觉模型）降级为人工复检提醒而不是质检结论。外部调用错误由 `ModelRouterImageClient` / `ModelRouterVisionClient` / `TokenPlanChatModel` 统一转换为可读异常，前端槽位与日志台展示完整错误信息。
