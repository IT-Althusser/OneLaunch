# OneLaunch 开发约定

OneLaunch 是跨境电商商品图片工作台。前端为 React + TypeScript，后端为 Java 25 + Spring Boot 4.0.6 + Spring AI 2.0.1，采用 npm workspaces 和 Maven。

本文件记录修改代码时需要遵守的约定。产品与运行方式见 [README](README.md)，具体机制见 [架构说明](docs/architecture.md)。

## 常用命令

在仓库根目录运行：

```powershell
npm ci
npm run dev:web
npm run dev:server
npm run build --workspace apps/web
mvn -B -f apps/server/pom.xml test
npm run build
```

前端开发端口为 5173，后端默认端口为 3101。`npm run build` 跳过后端测试，验证时应单独执行测试命令。

## 工程边界

- 沿用现有模块、依赖和命名，不为文档整理调整业务逻辑。
- TypeScript 保持 strict；后端 JSON 使用 Jackson 3 的 `tools.jackson` 包。
- 文本调用通过现有 Spring AI ChatClient 封装；图片和视觉调用分别使用已有客户端。
- 默认模型和网关由 `application.yml` 与环境变量管理，避免在业务代码散落默认值。
- API Key 仅由环境变量或本地 `.env` 提供，不写入源码、日志或前端响应。
- 主流程默认使用 Model Router。图生图诊断网关仅通过服务端预配置和请求中的 `editGateway=custom` 选择，不能向客户端暴露地址或密钥。
- 提交遵循 Conventional Commits；只提交当前任务涉及的文件。

## 图片与模型约定

- 主网关图片生成、编辑使用 `{type:"image", image:url}`；视觉调用使用 `{type:"image_url", image_url:{url}}`。不要混用两类输入。
- 提示词中的字面百分号进入 Java `.formatted()` 前必须写成 `%%`。
- P3 指用户首张原始商品参考图，是商品一致性的基准；修复后的图片不能替换这个基准。
- 生成、检测和修复要求复用 `ImageQualityContract`；平台和市场条目复用 `ComplianceRuleLibrary`。
- 硬性规则可用于生成和检测，风格规则只影响生成。
- 保留白底检测容差，避免将正常压缩噪点判为背景违规。
- 模特图着装要求需同时覆盖生成、检测和修复，不因参考图人物穿着而跳过。
- 编辑提示词中用户要求的改动优先；不要加入与“移除文字”等要求冲突的保持性约束。
- 修复建议应是可直接执行的图片修改指令，不是审核说明。
- 流水线尺寸图使用本地排版；检查失败后不调用模型自动重画数字。

## 状态与错误处理

- `QaRecord.status` 表示审核状态。视觉不可用时使用 `manual_review` 和 `passed=false`，不能伪造通过。
- 检查针对最终候选图，修复生成的新图必须重新检查；旧图结果不能沿用到新图。
- `compliance_complete` 表示图片和检查结束，`done` 才表示含详情页的完整流水线结束。
- 同平台、同图类的修复事件覆盖原槽位，不重复增加图片计数。
- `AppShell` 中运行中的生成和工具组件保持挂载，切换视图只隐藏，避免任务中断或重跑。
- 单图生成、本地化、独立检查失败返回可读错误；流水线中的可恢复错误使用现有降级路径并记录原因。

## 修改与验证

修改前读取当前文件及调用方，保留已有工作区变更。API 字段、事件或环境变量变化时，同步接口文档和运行指南；页面行为变化时同步产品与设计说明。

后端行为变更执行相关单元或回归测试，前端变更执行类型检查和构建。真实网关验证与使用测试替身的回归测试分别记录，不用单元测试结果替代真实图片质量结论。

## 文档索引

| 文档 | 内容 |
|---|---|
| [README](README.md) | 项目概览与快速开始 |
| [项目说明](项目说明.md) | 业务处理过程和实现选择 |
| [产品说明](PRODUCT.md) | 页面与使用场景 |
| [架构说明](docs/architecture.md) | 模块、图片处理、规则与恢复策略 |
| [API 接入指南](docs/integration-guide.md) | 路由、字段和事件 |
| [运行指南](docs/runbook.md) | 环境配置、检查和部署 |
| [设计规范](DESIGN.md) | 配色和组件约定 |
| [版本记录](docs/CHANGES.md) | 功能演进 |
