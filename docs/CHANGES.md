# 变更记录

## 2026-08-27（后端升级 + 图片生成跑通 + 清理）

- 后端升级为 **Java 25 + Spring Boot 4.0.6 + Spring AI 2.0.1**（Jackson 3：`tools.jackson.databind`；RestClient 超时改用 `Duration`），移除 Undertow，默认 Tomcat 11。
- 实测确定 Token Plan 图片调用方式并重写 `ModelRouterImageClient`：全部图片能力统一走 `POST /chat/completions` 多模态 content——文生图 `wan2.7-image-pro`（`[{type:"text"}]`），图生图 `qwen-image-2.0`（`[{type:"image",image:url},{type:"text"}]`）；`/images/generations`（url error）与异步调用（403）实测不可用，相关任务轮询接口一并移除。
- `/api/images/localize` 从异步任务改为**同步图生图编辑**，直接返回结果图；`GET /api/tasks/:taskId` 移除；`SingleImageRequest` 删除被忽略的 `size` 字段，响应 `size` 改为网关实际返回值。
- 端到端测试全部通过（真实 key）：`/api/health`、`/api/images/single`、`/api/images/localize`、`/api/images/set`（五图流水线 5/5 成功，返回真实图片 URL）。
- Token Plan 模型清单经 `GET /v1/models` 确认共 24 个且无 VL 视觉模型：选型收敛为 qwen3.7-max / wan2.7-image-pro / qwen-image-2.0，质检降级为人工复检提示。
- 清理旧版 Node/Express 后端遗留：`apps/server/src/*.ts`（routes/agents/services）、`package.json`、`tsconfig.json`、运行日志；后端为纯 Maven 工程。`.gitignore` 增加 `target/`、`.mvn-repo/`。
- 同步更新文档：`CLAUDE.md`（技术栈/目录/调用速查/路由）、`README.md`（模型表/附录 A 实测调用格式）、`docs/integration-guide.md`、`docs/architecture.md`、`docs/runbook.md`。

## 2026-08-27（早前）

- 前端完成工作室风格重构，补齐详情页展示与画幅交互。
- 后端模型 ID 切换为 Token Plan 支持的名称。
- Model Router 增加超时、错误和多响应格式处理。
- 前端 API 客户端增加单图重生成、本地化和异步任务查询。
- 删除未引用的 `DetailPagePanel.tsx` 与可再生构建产物。
- 清理 `apps/web/node_modules/.vite` Vite 缓存、`.impeccable/review/` 评审截图和 `.idea/` IDE 工作区配置；保留 Hook 配置、源码与参赛资料。
- 对齐默认 Token Plan 基地址、3100 后端端口，并记录图片接口 `url error` 已知限制。
- 后端迁移为 Java 21 + Spring Boot 3.4.1 + Spring AI 1.0.3；根命令改为 `npm run dev:server`（Maven）与 `npm run build`。
- Java API 保持 `/api/health`、`/api/images/set`、`/api/images/single`、`/api/images/localize`、`/api/tasks/:taskId` 契约。
- 迁移验证：Maven 构建成功；当前本机 JDK 25 启动时被 loopback selector 限制，Token Plan 图片端点直接返回 400 `url error`，尚未得到真实图片 URL。
