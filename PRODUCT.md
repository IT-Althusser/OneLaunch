# PRODUCT.md — OneLaunch · 一键出海

> 依据仓库 README.md / CLAUDE.md 的既定事实整理（2026-08-30，impeccable init 结构化模拟用户路径）。

## 产品是什么

跨境 **AI 商品图片生成工作台**。参赛场景一「AI 智能上新」，选定方向：AI 商品图片生成。
一句话：输入商品名称 / 卖点 / 商品参考图，分钟级产出多平台上架图包——白底图、场景图、模特图、对比图、尺寸图，按 Amazon / TikTok Shop / Temu / Shopee 风格规范适配；扩展能力为图片本地化（背景 / 风格替换）。

## 访客与场景（Operate 模式）

- 用户：跨境电商卖家，上架新品时需要快速拿到合规、可用的商品图。
- 核心任务：填资料 / 传参考图 → 选模型 → 生成 → 逐图检查、单图重新生成或修改 → 导出使用。
- 成功标准：过程实时可见（思考日志）、单图可返工、端到端返回真实图片 URL、新品上架从数天压缩到分钟级。

## 硬约束（不得违反）

1. 所有模型调用必须走大赛 **Model Router API**（Token Plan 网关），不得直连其他渠道；网关仅支持同步调用。
2. 模型选型只用大赛 126 清单内的模型（`GET /v1/models` 实测：图片模型 4 个；清单无 `vl` 字样模型，但 `qwen3.6-plus` / `qwen3.6-flash` 实测为多模态视觉模型，白底图质检由视觉模型自动执行）。
3. API Key 只走环境变量 `MODEL_ROUTER_API_KEY`，禁止硬编码。
4. 不偏离「AI 商品图片生成」方向；目标平台 Amazon、TikTok Shop 优先，兼顾 Temu、Shopee。

## 技术栈（既定，不迁移）

- 前端：React 18 + TypeScript + Vite + Tailwind（npm workspaces）
- 后端：Java 25 + Spring Boot 4.0.6 + Spring AI 2.0.1（Jackson 3：`tools.jackson`）
- 默认模型：qwen3.7-max（文本）/ wan2.7-image-pro（文生图）/ qwen-image-2.0（图生图）/ qwen3.6-plus（白底图视觉质检），支持按请求覆盖

## 视觉世界（既定）

暖纸底 `#f4f1eb`、奶白面板 `#fffdf9`、橙色 `#ef6a4c` 单一强调、深墨 `#19232b` 侧栏与日志控制台；panel（20px 圆角）与 field（12px）为唯一组件原语。
