# OneLaunch · 一键出海

OneLaunch 是面向跨境电商的 AI 商品图片工作台。输入商品资料和参考图，选择目标平台后，即可生成白底图、场景图、模特图、对比图和尺寸图，并查看逐图检查结果、修改建议和详情页草稿。

项目将图片生成、商品一致性检查、局部修改和市场本地化放在同一工作流程中，适合为 Amazon、TikTok Shop、Temu 和 Shopee 准备商品展示素材。

[项目详解](项目说明.md) · [产品说明](PRODUCT.md) · [API 文档](docs/integration-guide.md) · [运行指南](docs/runbook.md)

## 主要功能

| 功能 | 说明 |
|---|---|
| 多平台五图生成 | 按平台和图类组织提示词，每个平台处理五种商品图 |
| 参考图与商品画像 | 支持最多 6 张参考图；结合文字资料和首张图片的视觉描述生成素材 |
| 图片质检与修复 | 本地预检结合视觉模型检查，输出问题、严重度和修改指令；符合条件时自动修复 |
| 商品一致性检查 | 以用户首张原始参考图为基准，核对商品形状、结构、颜色、材质和固有文字 |
| 单图生成与编辑 | 按图类生成新图，或根据用户指令修改已有图片 |
| 图片本地化 | 调整背景场景、文字语言和模特形象 |
| AI 详情页 | 生成按平台组织的标题、卖点、图文模块和提示信息 |
| 市场规范 | 浏览与生成、检测共用的平台规则和市场规则 |
| 过程展示与下载 | SSE 实时展示处理进度，支持图片预览、原图下载和画幅裁切 |

白底图和对比图在条件允许时优先使用原图像素处理；流水线中的尺寸图使用 Java 2D 排版，数字来自提供的尺寸资料。白底图、场景图、模特图和对比图的自动修复默认最多 2 轮，尺寸图检查失败后保留结果供人工核对。

## 使用的技术

| 部分 | 实现 |
|---|---|
| 前端 | React 18、TypeScript、Vite 5、Tailwind CSS 3 |
| 图标与动画 | Lucide React、Framer Motion |
| 后端 | Java 25、Spring Boot 4.0.6、Spring AI 2.0.1 |
| 图片处理 | Java 2D |
| 模型接入 | Model Router API；可选的图生图诊断网关 |
| 工程管理 | npm workspaces、Maven |
| 数据交换 | REST JSON、SSE 事件流 |

前端负责创作向导、生成工作台和独立工具；后端负责模型调用、图片处理、规则加载及流程编排。图片生产和检查结束后，流水线会继续生成详情页草稿。详细过程见 [架构说明](docs/architecture.md)。

## 快速开始

### 1. 准备环境

安装 Node.js 20+、npm 10+、JDK 25 和 Maven。后端需要能够访问已配置的模型网关，并使用有效的 API Key。

### 2. 获取代码并安装依赖

```powershell
git clone https://gitcode.com/2502_94242477/OneLaunch.git
cd OneLaunch
npm ci
```

已有代码时，在仓库根目录执行后续命令即可。

### 3. 配置后端

```powershell
if (!(Test-Path apps/server/.env)) {
    Copy-Item apps/server/.env.example apps/server/.env
}
```

编辑 `apps/server/.env`，将 `MODEL_ROUTER_API_KEY` 的占位值替换为有效密钥。默认网关地址和端口已在示例中提供。密钥只保存在本地环境配置中。

常用配置：

| 变量 | 默认值 | 用途 |
|---|---|---|
| `MODEL_ROUTER_API_KEY` | 空 | 主网关密钥 |
| `MODEL_ROUTER_TEXT_MODEL` | `qwen3.7-max` | 商品画像、润色和详情页 |
| `MODEL_ROUTER_IMAGE_MODEL` | `wan2.7-image-pro` | 文生图 |
| `MODEL_ROUTER_EDIT_MODEL` | `qwen-image-2.0` | 参考图生成、修改和本地化 |
| `MODEL_ROUTER_VISION_MODEL` | `qwen3.6-plus` | 参考图描述和视觉检查 |
| `MODEL_ROUTER_QA_SCOPE` | `all` | 全五图检查；`white` 为仅白底兼容模式 |
| `PORT` | `3101` | 后端端口 |

完整配置、图生图网关选项和故障排查见 [运行指南](docs/runbook.md)。

### 4. 启动服务

在仓库根目录打开两个终端，分别执行：

```powershell
npm run dev:server
```

```powershell
npm run dev:web
```

打开 [前端工作台](http://localhost:5173)。后端默认监听 `127.0.0.1:3101`，可访问 [健康检查](http://localhost:3101/api/health)。前端开发服务器将 `/api` 代理到后端。

### 5. 创建图片任务

1. 点击首页的开始创作，添加商品参考图。
2. 填写名称、卖点，选择平台和目标市场；名称与参考图至少提供一项。
3. 选择模型并开始生成，在工作台查看每张图片的进度和检查结果。
4. 根据问题建议修改单张图片，按需使用本地化和详情页工具。
5. 预览并下载需要的图片。下载前核对商品外观、文字和尺寸。

切换工作台视图时，运行中的组件保持挂载；刷新或关闭页面后的任务恢复尚未实现。

## 项目目录

| 路径 | 说明 |
|---|---|
| `apps/web/src/components/create/` | 三步创作向导 |
| `apps/web/src/components/studio/` | 生成过程、图片槽位与检查结果 |
| `apps/web/src/components/shell/` | 页面布局、导航及工具实例管理 |
| `apps/web/src/components/market/` | 平台与市场规则浏览 |
| `apps/web/src/hooks/` | 模型目录和 SSE 流水线状态 |
| `apps/web/src/api/client.ts` | 前端 API 客户端 |
| `apps/server/src/main/java/com/onelaunch/` | API、流水线、模型客户端及图片处理 |
| `apps/server/src/main/resources/compliance-rules/` | 平台与市场规则 |
| `apps/server/src/test/java/com/onelaunch/` | 后端单元与回归测试 |
| `docs/` | 架构、接口、运行与版本文档 |

## 构建与测试

```powershell
# 前端类型检查和构建
npm run build --workspace apps/web

# 后端单元与回归测试
mvn -B -f apps/server/pom.xml test

# 前端构建及后端打包（此命令跳过后端测试）
npm run build
```

前端产物位于 `apps/web/dist/`，后端 JAR 位于 `apps/server/target/`。两者需要分别部署，后端 JAR 不包含前端静态页面。

## 当前边界

- 尚未接入数据库和对象存储，当前工作台中的结果不具备持久化历史。
- 网关图片地址可能过期，需要下载保存；本地渲染结果可能以 data URL 返回。
- 模型调用同步执行，SSE 展示的是应用处理进度。处理时间和调用次数取决于平台数量、生成方式和修复情况。
- 检测覆盖代码内置的图类契约及规则文件，属于图片风险筛查，不能保证平台审核通过。
- 原始出图尺寸由模型网关或本地渲染器决定，工作台可进一步裁切。
- 详情页是内容草稿；店铺自动发布、独立 Listing 写作和视频生成尚未实现。

## 文档

| 文档 | 内容 |
|---|---|
| [项目详解](项目说明.md) | 从一件商品到图片与详情页的完整处理过程 |
| [产品说明](PRODUCT.md) | 页面入口、使用方式和能力边界 |
| [架构说明](docs/architecture.md) | 模块职责、图片处理、规则库和错误恢复 |
| [API 接入指南](docs/integration-guide.md) | 接口、请求字段、响应结构及 SSE 事件 |
| [运行指南](docs/runbook.md) | 环境配置、构建部署和故障排查 |
| [设计规范](DESIGN.md) | 配色、组件和交互约定 |
| [开发约定](CLAUDE.md) | 修改代码时需要遵守的工程约定 |
| [版本记录](docs/CHANGES.md) | 主要功能演进 |
| [历史验证记录](docs/e2e-evidence-2026-09-06.md) | 指定版本、商品和环境下的网关验证结果 |
