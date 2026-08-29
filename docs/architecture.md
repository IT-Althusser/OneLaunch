# OneLaunch 架构说明

## 数据流

```text
React/Vite → Spring Boot /api/images/set → ImagePipelineService（Spring AI ChatClient + ModelRouterImageClient）
  → 商品画像（qwen3.7-max，/chat/completions 文本）
  → 平台化五图提示词 → 图片生成（wan2.7-image-pro，/chat/completions 多模态）
  → 白底图质检记录 → 详情页编排
  → images/qa/detailPages 返回前端
```

## 组件职责

- `TokenPlanChatModel`：Model Router `/chat/completions` 的 Spring AI `ChatModel` 实现，商品画像等文本能力统一走 Spring AI ChatClient。
- `ImagePipelineService`：流水线编排——商品画像、五图提示词、图片调用、质检记录与详情页降级模板。
- `ModelRouterImageClient`：图片能力封装——文生图（`wan2.7-image-pro`）与图生图编辑（`qwen-image-2.0`），统一走 `/chat/completions` 多模态 content（Token Plan 实测格式），带超时与错误解析。
- `HttpClientConfig`：统一 RestClient 超时（连接 10s，读取按 `model-router.timeout-seconds`，默认 120s）。

## 平台策略

第一个目标平台生成五类图片，其余平台生成白底主图适配版本。流水线逻辑集中在 `apps/server/src/main/java/com/onelaunch/ImagePipelineService.java`。

## 容错

任一步骤失败会记录到 `steps` 并继续流水线；画像和详情页均有降级结果。商品画像失败降级为纯文本拼接；Token Plan 无 VL 视觉模型，质检输出人工复检提示而不是视觉复检结论。外部调用错误由 `ModelRouterImageClient` / `TokenPlanChatModel` 统一转换为可读异常。
