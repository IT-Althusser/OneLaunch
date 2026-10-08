# OneLaunch 运行与维护指南

所有命令默认在仓库根目录执行。前端与后端是两个独立进程，开发时分别启动。

## 环境准备

需要 Node.js 20+、npm 10+、JDK 25 和 Maven，并配置好 Java 和 Maven 的命令路径。

```powershell
node --version
npm --version
java --version
mvn --version
npm ci
if (!(Test-Path apps/server/.env)) {
    Copy-Item apps/server/.env.example apps/server/.env
}
```

在 `apps/server/.env` 填写主网关密钥。不要覆盖已有环境配置，也不要将真实密钥提交到仓库。

## 服务配置

配置定义在 `apps/server/src/main/resources/application.yml`，支持进程环境变量以及工作目录下的 `.env`、`apps/server/.env` 属性文件。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3101` | 后端端口 |
| `SERVER_ADDRESS` | `127.0.0.1` | 后端监听地址 |
| `MODEL_ROUTER_BASE_URL` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | 主模型网关 |
| `MODEL_ROUTER_API_KEY` | 空 | 主网关密钥 |
| `MODEL_ROUTER_TEXT_MODEL` | `qwen3.7-max` | 文字画像、润色与详情页 |
| `MODEL_ROUTER_IMAGE_MODEL` | `wan2.7-image-pro` | 文生图 |
| `MODEL_ROUTER_EDIT_MODEL` | `qwen-image-2.0` | 参考图生成与图片编辑 |
| `MODEL_ROUTER_VISION_MODEL` | `qwen3.6-plus` | 视觉检查与参考图描述 |
| `MODEL_ROUTER_TIMEOUT_SECONDS` | `120` | 单次 HTTP 读取超时秒数，连接超时为 10 秒 |
| `MODEL_ROUTER_QA_SCOPE` | `all` | `all` 全图检查；`white` 白底专用检查 |
| `MODEL_ROUTER_EDIT_BASE_URL` | 空 | 可选编辑诊断网关 |
| `MODEL_ROUTER_EDIT_API_KEY` | 空 | 可选编辑网关密钥 |
| `MODEL_ROUTER_EDIT_API_STYLE` | `chat` | 自定义编辑协议，可选 `openai-images` |

`white` 模式只检查白底图，不等同于全图路径的市场规则和 P3 商品一致性检查。

可选编辑网关配置完成后，请求还需传入 `editGateway=custom` 才会使用它；默认请求仍走主网关。自定义网关主机要求为可解析的公网 HTTP(S) 地址，地址与密钥仅在服务端使用。编辑网关密钥留空时会沿用主网关密钥，连接不同提供方时应显式填写对应凭证。图生图以外的文字、视觉及文生图调用继续使用主网关。

### 本地预检与修复

`application.yml` 中的 `quality-policy` 提供：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `precheck.blur-variance` | `50.0` | 拉普拉斯方差低于阈值时提示模糊 |
| `precheck.noise-mad` | `20.0` | 中值残差高于阈值时提示重度噪点 |
| `precheck.scene-border-std` | `8.0` | 场景边缘过于均匀时提示缺少场景 |
| `precheck.skin-ratio` | `0.02` | 模特区域肤色比例启发式阈值 |
| `repair.max-attempts` | `2` | 自动修复轮数 |
| `repair.min-severity` | `高` | 视觉问题触发修复的最低严重度 |

调整阈值应通过实际图片复核误报。规则文件在启动时读取，修改规则或应用配置后需要重新构建或重启相应服务。

## 开发启动

终端一：

```powershell
npm run dev:server
```

终端二：

```powershell
npm run dev:web
```

默认打开 `http://localhost:5173`。前端开发代理在 `apps/web/vite.config.ts` 中将 `/api` 转发到 `http://localhost:3101`。后端改端口时，需要同步修改代理目标并重启前端。

前端 5173 被占用时可能改用其他端口，以 Vite 终端输出为准。

## 连通性与验证

```powershell
Invoke-RestMethod http://localhost:3101/api/health
Invoke-RestMethod http://localhost:3101/api/compliance-rules
Invoke-WebRequest http://localhost:5173/
```

健康接口只验证应用响应，规则接口不调用模型。`GET /api/models` 会访问网关；返回默认列表时仍应检查 `error` 和 `editError`。

```powershell
npm run build --workspace apps/web
mvn -B -f apps/server/pom.xml test
npm run build
```

第一条执行前端类型检查和构建，第二条运行后端测试，第三条构建前端并打包后端，第三条会跳过后端测试。

真实图片冒烟脚本位于 `apps/server/scripts/compliance-smoke.ps1`，会调用生成、合规检查和本地化接口并消耗模型额度。执行前需启动后端、配置有效密钥，并核对脚本中的端口和模型：

```powershell
powershell -File apps/server/scripts/compliance-smoke.ps1
```

单元与回归测试主要使用测试替身隔离模型调用，不能代替真实网关和图片质量验证。

## 构建与部署

构建产物：

| 路径 | 用途 |
|---|---|
| `apps/web/dist/` | 前端静态站点 |
| `apps/server/target/onelaunch-server-0.2.0.jar` | 可执行后端 JAR |

从仓库根目录启动打包后的后端：

```powershell
java -jar apps/server/target/onelaunch-server-0.2.0.jar
```

部署到独立目录时，提供进程环境变量或该工作目录的 `.env` 文件。后端默认仅监听本机；同机反向代理可转发到 `127.0.0.1:3101`。

静态服务托管 `apps/web/dist/`，并将同域 `/api` 转发到后端。SSE 路径需要及时转发响应块并允许长连接；不能把 Vite 的开发代理配置当作生产环境配置。后端 JAR 不包含前端静态页面。

当前 API 没有账号鉴权和配额管理，公网部署需要在入口提供相应访问控制。任务状态没有持久化，进程重启或页面刷新后无法恢复原任务。

## 常见问题

| 现象 | 检查方法 |
|---|---|
| 前端接口连接失败 | 核对后端是否启动、端口和 Vite 代理目标是否一致 |
| 网关 401 | 核对服务端密钥是否有效，不在日志中输出密钥 |
| 网关 403 / 404 | 核对网关基地址、模型权限与套餐能力 |
| 模型不存在 | 查看模型目录及错误字段，再核对配置的模型 ID |
| 模型目录非空但生成失败 | 目录可能已回退为默认模型，检查 `error` 字段 |
| 图片请求超时 | 核对图片源能否被网关访问，检查网络、额度和读取超时 |
| 编辑请求格式错误 | 主网关编辑使用扁平 `image`；视觉使用嵌套 `image_url`；自定义网关还需匹配协议 |
| 自定义编辑网关不可用 | 核对公网地址、服务端配置、模型目录和请求路由标志 |
| 生成成功但显示待复检 | 视觉调用或解析失败，应按错误信息重试检查 |
| 尺寸文字错误 | 核对原始尺寸资料；单图工具使用模型，不能直接套用流水线本地排版结论 |
| 白底反复失败 | 查看实际背景、预检结果和视觉问题；保留近白容差，避免只按 RGB 255 判断 |
| 详情页还在生成 | `compliance_complete` 仅表示图片检查结束，完整流程以 `done` 为准 |
| 图片链接失效 | 网关 URL 可能过期，下载保存结果或重新生成 |

曾在特定 Windows JVM 环境中出现 `Unable to establish loopback connection`，历史验证通过指定可用的 Unix Domain Socket 临时目录解决。仅复现该错误时在当前终端临时设置：

```powershell
$socketDir = Join-Path (Get-Location) '.tmp/java-sockets'
New-Item -ItemType Directory -Force $socketDir | Out-Null
$previousJavaOptions = $env:JAVA_TOOL_OPTIONS
try {
    $env:JAVA_TOOL_OPTIONS = ($previousJavaOptions + ' -Djava.net.preferIPv4Stack=true -Djdk.net.unixdomain.tmpdir="' + $socketDir + '"').Trim()
    npm run dev:server
}
finally {
    $env:JAVA_TOOL_OPTIONS = $previousJavaOptions
}
```

## 文件管理

源码和规则文件纳入 Git。`.env`、依赖目录、构建产物、日志和本地工具缓存由 `.gitignore` 排除。

保存问题证据时记录时间、接口、模型、输入条件和响应状态；不要记录密钥或可用的带签名图片地址。历史单商品验证见 [验证记录](e2e-evidence-2026-09-06.md)。
