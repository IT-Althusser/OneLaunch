# 真实 E2E 证据（2026-09-06）

## 环境与口径

- 环境：本机开发环境，后端 `onelaunch-server-0.2.0.jar`，Java 25，端口 `3100`；前端构建产物与后端同一工作区。
- 网关：Model Router Token Plan；模型调用使用环境变量注入的凭证，本文不记录 API Key。
- 后端启动时间：2026-09-06 15:44:10（Asia/Shanghai）。启动日志确认加载平台规则 4 份、市场规则 5 份。
- 本次完整流水线设置：`MODEL_ROUTER_QA_SCOPE=all`。
- 签名 URL 有时效，仅证明当时返回；为避免提交长期保存失效链接及签名参数，本文不展开列出 URL。原始 SSE 响应保存在本机 `D:\codex-content\2026-09-06\onelaunch-audit\pipeline-raw-2026-09-06.jsonl`。

## 测试一：合规冒烟脚本

执行命令：

```powershell
apps/server/scripts/compliance-smoke.ps1
```

执行结果：

| 项目 | 结果 |
|---|---|
| `GET /api/health` | 成功，返回 `ok: true` |
| `POST /api/images/single` | 成功，网关返回图片 URL |
| `POST /api/compliance-check` | 成功，Amazon/US 场景图检测返回 `passed: true`、空问题列表 |
| 本地化 `scene` | 成功，返回 1024x1024 图片 |
| 本地化 `text` | 成功，返回 1024x1024 图片，并带文字需人工复核提示 |
| 本地化 `model` | 成功，返回 1024x1024 图片 |

脚本原始输出：`D:\codex-content\2026-09-06\onelaunch-audit\smoke-2026-09-06.log`。本轮未发生失败，无需重试。

脚本日志写入窗口：2026-09-06 15:44:35–15:45:39（约 64 秒，包含网关响应等待）。

## 测试二：Amazon 单平台完整流水线

请求：`POST /api/images/set/stream`，平台 `Amazon`，市场 `US`，商品为“轻量通勤托特包”，使用 `wan2.7-image-pro`、`qwen-image-2.0`、`qwen3.7-max`、`qwen3.6-plus`，未上传参考图。

- 开始：2026-09-06 15:47:12.269（Asia/Shanghai）
- `done`：2026-09-06 15:52:50.686（Asia/Shanghai）
- 总耗时：338.417 秒（5 分 38.417 秒）
- SSE 事件数：57；HTTP 状态：200；以 `done` 事件正常结束。

### 分阶段耗时

| 阶段 | 事件边界 | 实测耗时 |
|---|---|---:|
| 商品画像 | 画像开始 → `profile` 完成 | 14.566 秒 |
| 五图生成 | 首个 `image_start` → 最后一个 `image_done` | 230.027 秒 |
| 全量合规检测 | 首个 `qa` →“图片合规检测完成” | 48.544 秒 |
| 详情页 | 详情页编排开始 → Amazon 详情页完成 | 41.677 秒 |
| 请求总计 | 请求开始 → `done` | 338.417 秒 |

### 结果明细

- 当前实现的单平台图片项为 5 类图（白底、场景、模特、对比、尺寸），不是 10 个图片槽位；本次实际生成成功 **5/5**，无 `image_fail`。
- 质检/合规共 5 条：`passed` 1、`failed` 3、`manual_review` 1。人工复检记录保持旧字段 `passed=true`，由新增 `status=manual_review` 表达降级未审核语义。
- 白底图检测通过，因此本次未触发“白底图不通过后的自动重试”；没有重试结果可记录。
- Amazon 详情页 1 页，共 **7 个模块**，`done` 事件返回 `AI 组合 7 个模块`。
- 5 张图片和 5 条质检均在 `done` 事件中返回；规则来源日志为 Amazon 平台规则与 US 市场规则。

### 降级结果复检

流水线中的场景图首次视觉解析因问题字段不完整降级为 `manual_review`。按要求使用该图片再次调用 `POST /api/compliance-check`：第一次尝试时流水线结束后的后端进程已退出，返回连接拒绝（非业务响应）；排查确认 3100 端口无监听后重启同一最新构建，再重试一次。第二次请求于 2026-09-06 16:11:15 开始，HTTP 200，耗时 12.806 秒，返回 `passed=false`、模型 `qwen3.6-plus`，识别到商品表面 Amazon 标识的授权/商标风险。复检原始响应保存在本机 `D:\codex-content\2026-09-06\onelaunch-audit\scene-qa-retry-2026-09-06.json`。

## 结论

本次两轮真实调用均完成：冒烟脚本覆盖健康检查、合规检测和本地化三维度；Amazon `qa-scope=all` 流水线完成画像、五图生成、全量合规检测和 7 模块详情页编排。流水线真实暴露了 3 张拦截图和 1 张需人工复检图，复检后进一步确认场景图存在商标授权风险，说明合规状态与降级状态均被实际记录，而不是只验证成功路径。
