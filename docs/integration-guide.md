# OneLaunch API 接入指南

后端默认地址为 `http://localhost:3101`，所有业务接口以 `/api` 开头。JSON 请求使用 `Content-Type: application/json`。模型密钥由服务端环境配置提供，客户端请求不携带模型网关密钥。

当前应用 API 没有账号鉴权层；默认后端仅监听本机。对外部署方式见 [运行指南](runbook.md)。

## 接口总览

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 服务健康 |
| GET | `/api/models` | 模型分组、默认模型和平台市场映射 |
| GET | `/api/compliance-rules` | 平台和市场规则快照 |
| GET | `/api/image-proxy` | 图片读取与下载 |
| POST | `/api/polish` | 卖点或关键词润色 |
| POST | `/api/images/set` | 同步五图流水线 |
| POST | `/api/images/set/stream` | SSE 五图流水线 |
| POST | `/api/images/single` | 单图生成或编辑 |
| POST | `/api/images/localize` | 图片本地化 |
| POST | `/api/compliance-check` | 独立图片检查 |
| POST | `/api/detail-page` | 独立详情页生成 |

## 通用字段

图类取值为 `白底图`、`场景图`、`模特图`、`对比图`、`尺寸图`。内置平台为 `Amazon`、`TikTok Shop`、`Temu`、`Shopee`；市场为 `US`、`UK`、`欧盟`、`日本`、`东南亚`。

图片输入支持可访问的 HTTP(S) URL 或完整的 `data:image/...;base64,...`。返回的 `GeneratedImage` 包含 `type`、`platform`、`size`、`url`，其中 `url` 也可能是本地渲染结果的 data URL。

`imageModel`、`editModel`、`textModel`、`visionModel` 用于五图请求中的模型覆盖；单图、本地化和润色接口使用各自的 `model` 字段。

## 五图与详情页

### 同步请求

`POST /api/images/set` 接收：

```json
{
  "productName": "通勤托特包",
  "sellingPoints": "填写真实的材质、用途和尺寸资料",
  "platforms": ["Amazon"],
  "detailTone": "专业可信",
  "referenceImages": [],
  "market": "",
  "editGateway": "default"
}
```

| 字段 | 规则 |
|---|---|
| `productName` | 与非空 `referenceImages` 至少提供一项 |
| `sellingPoints` | 可选商品事实和尺寸资料 |
| `platforms` | 可选；空列表或省略时使用 Amazon，元素不能为空 |
| `detailTone` | 可选；前端提供专业可信、种草转化、简洁高端 |
| `referenceImages` | 可选，最多 6 张，支持图片 URL 和 data URL |
| `market` | 可选；空值按平台映射，显式值覆盖所有所选平台 |
| `imageModel` / `editModel` / `textModel` / `visionModel` | 可选模型覆盖 |
| `editGateway` | 仅 `custom` 选择服务端预配置的编辑网关，其他值使用主网关 |

默认平台映射：Amazon → US，TikTok Shop / Shopee → 东南亚，Temu → 欧盟。

响应为 `ImagePipelineResponse`：

| 字段 | 类型与内容 |
|---|---|
| `steps` | `{step, status, detail}[]`，各处理步骤和错误信息 |
| `profile` | 商品画像文字，可能为空 |
| `images` | `GeneratedImage[]`，成功生成的图片 |
| `qa` | `QaRecord[]`，按审核范围执行后的记录 |
| `detailPages` | `DetailPage[]`，逐平台详情页草稿 |

每个平台处理五个槽位；部分图片失败时，响应图片数可能不足五张。尺寸排版需要可读取的商品图片：使用原始参考图或通过质检的白底图，没有可用源图时该槽位会失败。HTTP 200 或流程完成不代表每张图片生成成功或审核通过。

### SSE 请求

`POST /api/images/set/stream` 接收相同 JSON，返回 `text/event-stream`。客户端需要读取 POST 响应流，不能直接使用只发送 GET 的原生 `EventSource` 连接此接口。

| 事件 | 负载 | 含义 |
|---|---|---|
| `log` | `{text}` | 处理阶段与结果日志 |
| `profile` | `{text}` | 文字商品画像 |
| `image_start` | `{type, platform, prompt}` | 单图开始 |
| `image_done` | `{type, platform, size, url, prompt}` | 单图完成或被修复图替换 |
| `image_fail` | `{type, platform, error}` | 单图生成失败 |
| `qa` | `QaRecord` | 该图片最终检查结果 |
| `compliance_complete` | `{images, qa}` | 图片生产与检查结束，详情页尚可能运行 |
| `done` | `ImagePipelineResponse` | 含详情页的完整结果 |
| `fatal` | `{error}` | 流程级失败 |

以“平台 + 图类”作为槽位键处理覆盖更新。修复会重复发送 `image_done`，不能把它累计为新图片。服务端发送的日志是流程说明，不是模型内部思维内容。

### 审核记录

`QaRecord` 包含：

| 字段 | 说明 |
|---|---|
| `type` / `platform` / `market` / `url` | 检查对象及归属 |
| `status` | `passed`、`failed`、`manual_review` |
| `passed` | 布尔结果，人工复检时为 false |
| `comment` | 检查说明 |
| `issues` | 兼容文本问题列表，人工复检时可能为 null |
| `complianceIssues` | 结构化问题列表 |
| `suggestedPrompt` | 可用于修复的指令，可能为空或 null |
| `model` | 检查模型或“本地预检”；人工复检时可能为 null |
| `passReasons` | 检查通过依据 |

结构化问题为 `{dimension, severity, detail, suggestion}`。维度包括平台规范、市场规范、商品一致性、文字准确性、其他；严重度为高、中、低。

默认 `all` 检查五类图片，并在有原始参考图时检查商品一致性。`white` 只运行白底专用检查。预检失败或达到严重度条件的问题可触发修复，默认最多 2 轮；尺寸图不进入模型自动修复，白底图另有一次文生图兜底。

## 单图生成与修改

`POST /api/images/single`：

```json
{
  "type": "场景图",
  "prompt": "在自然光下展示商品的日常使用场景",
  "platform": "Amazon",
  "referenceImages": []
}
```

`type` 和非空 `prompt` 必填，`platform` 默认 Amazon。其他可选字段为 `referenceImages`、`sourceUrl`、`model`、`editGateway`。

处理优先级：

1. 有 `sourceUrl`：以源图和用户指令进行编辑。
2. 否则有参考图：按图类与平台要求进行参考图生成。
3. 否则：使用文生图模型。

返回 `{image: GeneratedImage}`。该接口本身不返回质检结果；项目的单图前端在生成后另行调用 `/api/compliance-check`。图片模型返回空结果时，`image` 可能为 null，客户端应处理没有图片的情况。

## 图片本地化

`POST /api/images/localize` 需要 `sourceUrl`。其他字段：

| 字段 | 说明 |
|---|---|
| `targetMarket` | 默认 US |
| `aspects` | `scene`、`text`、`model` 的组合；省略默认 scene，空数组或非法值返回 400 |
| `targetLanguage` | text 维度的语言；未填时日本使用日语，其余使用英语 |
| `modelProfile` | model 维度的人物要求 |
| `instruction` | 附加编辑指令 |
| `model` / `editGateway` | 编辑模型与网关选择 |

返回 `{image, appliedAspects, note, prompt}`。`text` 生效时 `note` 包含文字复核提醒。模型未返回图片时可能没有响应内容，客户端应先检查结果再读取字段。

## 独立图片检查

`POST /api/compliance-check` 需要 `imageUrl`、`platform`、`market`。可选字段：

- `imageType`：默认白底图。
- `visionModel`：覆盖视觉模型。
- `productFacts`：原始商品资料。
- `referenceImageUrl`：P3 原始商品图；传入时与待检图一起做本体一致性比较。

响应包含 `passed`、`summary`、`issues`、`complianceIssues`、`suggestedPrompt`、`model`、`passReasons`。它与流水线的 `QaRecord` 不同，没有 `status` 字段，说明字段名为 `summary`。

检查范围为图类与平台规范、市场规则中的可见要求，以及有参考图时的商品本体一致性。独立检查调用失败返回错误；流水线检查失败则生成 `manual_review` 记录继续执行。

## 详情页

`POST /api/detail-page`：

```json
{
  "productName": "通勤托特包",
  "sellingPoints": "填写商品的真实卖点",
  "platforms": ["Amazon"],
  "detailTone": "专业可信",
  "generatedTypes": ["白底图", "场景图"]
}
```

`productName` 与 `sellingPoints` 至少一项；`platforms` 省略或为空时使用 Amazon。`textModel` 可覆盖文本模型。`generatedTypes` 表示可引用的已有图类，不会由此接口生成图片。

返回 `{detailPages: DetailPage[]}`。每个页面包含 `platform`、`title`、`subtitle`、`sellingPoints`、`sections`、`compliance`；每个 section 包含 `type`、`title`、`body`、`imageType`、`bullets`。

模型提示词要求英文输出，失败时使用模板；模板可能保留输入卖点原文。配图是图类引用，客户端需要关联实际图片。

## 文案润色

`POST /api/polish`：

```json
{
  "text": "日常通勤使用，分隔收纳，轻便",
  "kind": "selling-points"
}
```

`text` 必填且长度不超过 4000。`kind=selling-points` 用于分条卖点，`keywords` 用于单行关键词；`model` 可选。返回 `{text}`。

## 模型目录与规则

### 模型目录

`GET /api/models` 返回：

- 模型列表：`textToImage`、`imageToImage`、`text`、`vision`、`other`，列表项为 `{id, verified}`。
- 编辑网关：`editToImage`、`editGateway`、`editError`。
- 默认和状态：`defaults`、`visionAvailable`、`qaScope`、`error`。
- 市场数据：`platformMarkets`、`markets`。

主目录失败时回退到服务端默认模型并设置 `error`。自定义编辑目录失败单独设置 `editError`。`verified` 是代码内的标记，不是实时生成或鉴权测试；视觉列表按客户端内置能力名单筛选。

### 规则快照

`GET /api/compliance-rules` 返回 `{platforms, markets}`。每项为 `{key, label, sections}`，section 为 `{name, rules}`，rule 为 `{id, hard, text}`。`hard=true` 为硬性规则，false 为生成风格建议。

## 健康与图片代理

`GET /api/health` 返回 `{"ok":true,"service":"onelaunch-java-server"}`，只说明应用可响应，不验证模型网关。

`GET /api/image-proxy?url=<编码后的HTTP图片地址>&download=false` 返回图片字节；`download=true` 添加附件下载头。data URL 应由客户端直接处理，不放入代理查询参数。代理失败返回 400 和文本说明。

## 错误与接入建议

参数校验错误通常返回 400，业务调用异常通常返回 500，响应形如 `{"error":"可读说明"}`。框架解析 JSON 失败、模型目录降级和图片代理使用各自的响应形式。SSE 建连后的异常通过 `fatal` 或单图事件报告。

模型生成、编辑和检查会消耗网关额度。需要验证客户端连通性时先使用健康接口；真实业务验证应检查响应内容、图片和审核状态。

主网关当前客户端使用同步 `/chat/completions`：文本传字符串，图片生成/编辑使用扁平 `image` part，视觉使用嵌套 `image_url` part。自定义编辑网关还支持 `openai-images` 格式。完整服务端配置见 [运行指南](runbook.md)。
