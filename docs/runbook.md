# OneLaunch 运维手册

## 启动

```powershell
npm install
mvn -f apps/server/pom.xml spring-boot:run   # 或 npm run dev:server
npm run dev:web
```

默认前端端口为 5173，后端端口由 `apps/server/.env` 的 `PORT` 控制，当前为 3100。

## 冒烟检查

默认 `MODEL_ROUTER_QA_SCOPE=all`，五图均做合规检测并核对原始资料；已有环境若显式设置为 `white`，需改为 `all` 后重启。尺寸图支持明确的“宽38cm、高30cm、厚12cm”等带单位资料，没有资料则显示未提供；示例中的尺寸是演示设定。真实图片冒烟脚本位于 `apps/server/scripts/compliance-smoke.ps1`。

```powershell
Invoke-WebRequest http://localhost:3100/api/health
Invoke-WebRequest http://localhost:5173/
npm run build        # web: tsc + vite build；server: Maven package
```

## 常见故障

- AI 代理运行环境若出现 `Unable to establish loopback connection`：这是本机 JVM 临时 Unix Domain Socket 连接限制，非商品图业务缺陷。2026-09-06 实测仅设置 `preferIPv4Stack` 与普通 `java.io.tmpdir` 不足；指定实际存在的 D 盘 `jdk.net.unixdomain.tmpdir` 后服务启动成功。宿主普通 shell 先直接启动，只有复现该错误时才采用下例，不修改全局环境变量或网关协议。

```powershell
New-Item -ItemType Directory -Force D:\codex-content\java-sockets | Out-Null
$env:JAVA_TOOL_OPTIONS = '-Djava.net.preferIPv4Stack=true -Djdk.net.unixdomain.tmpdir=D:\codex-content\java-sockets'
npm run dev:server
# 服务结束后：Remove-Item Env:JAVA_TOOL_OPTIONS
```

- `401`：检查 `MODEL_ROUTER_API_KEY` 是否存在且未过期。
- `403/404`：确认使用 Token Plan 专属基地址，不要改成通用 DashScope 地址。
- `model_not_found`：用 `GET /v1/models` 核对 Token Plan 实际可用模型名（不带 `qwen/` 前缀），并用 `MODEL_ROUTER_*_MODEL` 环境变量覆盖。
- 图片生成超时：检查网络和套餐额度；后端会返回可读的超时错误（读取超时默认 120s，可用 `MODEL_ROUTER_TIMEOUT_SECONDS` 调整）。
- 端口被占用：更改 `PORT`，并同步 `apps/web/vite.config.ts` 的代理端口。

## 安全

`.env`、API Key、日志、`target/` 构建产物与 `.mvn-repo/` 本地仓库均不应提交仓库（已列入 `.gitignore`）。不要在终端输出或截图中暴露密钥。

## 图片接口故障排查

- `url error`：Token Plan 的 `/images/generations` 不可用。本项目全部图片能力改走 `/chat/completions` 多模态调用（见 `ModelRouterImageClient.java`），该错误不应再出现；若网关未来放开该端点，可再评估切换。
- 异步 403：Token Plan Key 不支持异步调用，本地化接口为同步图生图，无需轮询。
- 图文混合 content 报 400：图片生成/编辑模型必须用 `{type:"image", image:url}` 扁平字段；视觉理解模型（`ModelRouterVisionClient.java`，白底图质检）相反必须用 OpenAI 嵌套 `{type:"image_url", image_url:{url}}` 格式，并建议 `"enable_thinking": false`。
- 视觉质检报 `must be larger than 10`：视觉理解要求图片宽高大于 10px（1×1 测试图会触发）。
- 指定尺寸不生效：网关忽略 `size` 参数（实测），投放画幅由前端单图工作台按 1:1 / 3:2 / 2:3 居中裁切（依赖同源代理 `GET /api/image-proxy`）。

## 清理

Vite 缓存和评审截图均为可再生文件，已从工作区移除；`.impeccable` 配置、源码、参赛附加材料和 `ModelRouter_API.docx` 原始资料保留。旧版 Node/Express 后端遗留（`src/*.ts`、`package.json`、`tsconfig.json`）与运行日志已删除，后端为纯 Maven 工程。
