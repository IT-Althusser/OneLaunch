# OneLaunch 架构说明

## 数据流

自研 Spring Boot 事件驱动工作流编排画像 Agent、提示词 Agent、质检 Agent、合规 Agent、详情页 Agent 五个职责角色，图片生成作为工具调用嵌入；未引入独立 Agent 框架。角色不等同独立模型实例：提示词组装使用代码模板与画像文本，all 模式的质检和合规共用一次视觉请求。角色名显示在 SSE 日志与步骤中，不增加模型调用次数。

```text
React/Vite → Spring Boot /api/images/set/stream（SSE，主流程；/api/images/set 为同步兼容）
  → 商品画像（文本模型，默认 qwen3.7-max，可按请求覆盖，/chat/completions 文本）
  → 平台化五图提示词
      ├─ 无参考图 → 文生图（wan2.7-image-pro，可覆盖）
      └─ 有参考图（URL 或 base64，≤6 张）→ 图生图（qwen-image-2.0，可覆盖，保持商品一致）
  → 每张图实时推送 image_start / image_done / image_fail / qa 事件
  → 全图类合规检测（qwen3.6-plus：平台规范、目标市场广告法、文字准确性与其他问题；qa-scope 控制 all/white，失败降级人工复检）
  → AI 详情页自动化：文本模型按平台规范（Amazon/TikTok/Temu/Shopee）组合画像+卖点+配图引用，输出结构化 JSON，失败降级模板
  → 前端：五图槽位四态（pending/running/done/failed）+ 思考日志台 + 单图工作台（参考素材/文字描述/画幅裁切）+ AI 详情页图文编排
```

前端工作台实例常驻挂载：生成工作台与各单图工具工作台切换时只隐藏不卸载（`App.tsx` 以 `toolPages` 实例集合 + `toolPage` 当前查看管理，`seq` 为实例标识），运行中的生成/检测任务在后台继续，页头胶囊提示一键返回；同工具运行中或已有结果时复用实例。单图工具工作台生成五类图成功后，新图 URL 自动直传 `/api/compliance-check` 复检（平台按工具、市场按平台映射），结果内联展示，未通过时可以新图为源图一键按修复指令再生成——形成生成 → 检测 → 修复 → 再检测闭环。

## 组件职责

- `TokenPlanChatModel`：Model Router `/chat/completions` 的 Spring AI `ChatModel` 实现，商品画像等文本能力统一走 Spring AI ChatClient；请求带 `ChatOptions.model` 时按请求覆盖模型 ID。
- `ImagePipelineService`：流水线编排——商品画像、五图提示词、图片调用、质检记录、AI 详情页自动化（按平台规范组合配图引用与文案，解析失败降级模板）；核心 `run(request, emit)` 以事件回调驱动，同步端点静默消费事件，`runStream` 包装为 SseEmitter（虚拟线程执行）。另提供独立详情页生成 `generateDetailPages`（`POST /api/detail-page`，画像 + 逐平台编排 + 降级模板，与五图流水线解耦，共用 `profilePrompt` 与 `aiDetailPage`）。
- `ModelRouterImageClient`：图片能力封装——文生图与图生图（参考图/编辑/本地化）统一走 `/chat/completions` 多模态 content（Token Plan 实测格式），`image` 字段接受公网 URL 与 base64 data URL，支持多参考图（≤6）与模型覆盖；另提供 `listModels()`（GET /v1/models）与 `fetchImage()`（同源图片代理，供前端画幅裁切与下载）。
- `ModelRouterVisionClient`：视觉理解封装——白底图质检（内容理解与合规检测），用 OpenAI 嵌套 `image_url` 格式传图（URL/base64 均可）+ `enable_thinking:false`，输出结构化 JSON（passed/issues/summary/suggestedPrompt）解析为质检记录（未通过时样例驱动自动重试一次）；模型限 126 清单内实测具备视觉能力者（`qwen3.6-plus` 默认 / `qwen3.6-flash`），供 `GET /api/models` 的 `vision` 分组与 `visionAvailable` 判定。
- `HttpClientConfig`：统一 RestClient 超时（连接 10s，读取按 `model-router.timeout-seconds`，默认 120s）。

## 平台策略

每个目标平台均生成全部五类图片（图片调用次数 = 平台数 × 5）；提示词按「平台 × 图类」注入 20 组差异化规则（`platformRule`：每平台独有的构图、氛围与合规要求，如 TikTok 竖版抓拍感、Temu 参数直给、Shopee 移动端简洁、Amazon 专业棚拍），多平台图片组互不雷同。流水线逻辑集中在 `apps/server/src/main/java/com/onelaunch/ImagePipelineService.java`。

## 容错

合规检测默认 `qa-scope=all`，每出一张立即审核，并对照原始商品资料。合格白底图作为后续生成参考；四类模型生成图最多自动修复一次，尺寸图由 Java 2D 确定性排版。SSE 仅推送 `qa` 当前结果（初检在服务端内部决定是否自动修复，不单独发事件；同平台同图类复检覆盖前一次记录）。视觉 JSON 格式恢复最多一次，不能抹掉已有问题；审核未完成时 `status=manual_review` 且 `passed=false`。独立检测入口覆盖全部五类图。

合规检测由规则知识库驱动：`ComplianceRuleLibrary` 启动扫描 `resources/compliance-rules/platform/*.md` 与 `market/*.md`，剥离 HTML 来源注释并缓存到不可变 Map；目前平台 4 文件、市场 5 文件。英文名称转小写并将空格换为连字符作为文件名，中文市场使用既有别名（日本→japan、欧洲/欧盟→eu、东南亚→sea）。增加匹配名称的规则文件、重新构建并重启即可加载；新增前端可选市场/平台仍需同步界面选项。文件缺失、空文件或加载失败均记录告警，回退通用文案，未知市场不会误用 US 规则。SSE 合规日志显示文件来源或兜底状态。五图生成风格规则暂留代码，后续统一入库，再演进为规则与案例向量知识库 + RAG。

白底图在 all/white 模式均最多重试一次，二次审核沿用相同范围；重试异常时恢复原图及原质检记录。非白底图失败不自动重生成。`qa` 事件含 platform，前端按平台与图类更新记录，重试不会重复计数。人工复检的旧响应保留 passed=true 兼容标记，但 model=null 表示未完成审核，界面显示黄色待复检；返工后的旧图审核不再用于新图。

白底判定采用检测容差（2026-09-07）：AI 编辑模型产出的"纯白"背景实际为 RGB 245–254 且带轻微压缩噪点，检测端若苛求 RGB 255,255,255 会把正常压缩噪点判为"高噪点"，导致修复循环永不收敛。`ModelRouterVisionClient` 的合规检测与白底质检提示词均注入容差规则——背景各 RGB 通道 ≥245 且均匀干净、无场景元素/道具/明显阴影即判纯白合规；轻微压缩噪点、极浅渐变、±10 白色偏差不构成未通过理由；只有可辨认场景元素、道具、明显阴影或成片杂色纹理才判背景违规。生成端（`editFromSourcePrompt`）仍要求完全重绘背景、无噪点无残影，两端容差匹配后修复循环可收敛。

任一步骤失败会记录到 `steps`、以 `image_fail`/`log` 事件推给前端并继续流水线；画像和详情页均有降级结果。商品画像失败降级为纯文本拼接；无文字信息且只有参考图时跳过画像直接按参考图生成；白底图视觉质检失败（调用/解析异常或网关暂无可用视觉模型）降级为人工复检提醒而不是质检结论。外部调用错误由 `ModelRouterImageClient` / `ModelRouterVisionClient` / `TokenPlanChatModel` 统一转换为可读异常，前端槽位与日志台展示完整错误信息。
