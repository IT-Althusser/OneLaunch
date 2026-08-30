---
name: OneLaunch · Selling Image Studio
description: 跨境 AI 商品图片生成工作台——暖纸工作区 + 深墨控制台的双世界视觉系统
colors:
  paper: "#f4f1eb"
  cream: "#fffdf9"
  paper-deep: "#f8f5ef"
  paper-bright: "#fffaf3"
  ink: "#19232b"
  ink-raised: "#1f2b35"
  ink-idle: "#3d4c54"
  ink-text: "#17202b"
  text-strong: "#39342e"
  text-label: "#514b43"
  text-secondary: "#5e584f"
  text-body: "#6f685e"
  text-soft: "#777168"
  text-muted: "#8d867c"
  text-eyebrow: "#8b8479"
  text-faint: "#a49d92"
  primary: "#ef6a4c"
  primary-hover: "#d95d41"
  primary-text: "#c84f36"
  primary-deep-text: "#b84934"
  primary-tint: "#fff1ed"
  primary-tint-border: "#f0b7a8"
  primary-disabled: "#c9c1b7"
  border: "#e2ddd5"
  border-strong: "#d9d3c9"
  border-soft: "#e8e2d9"
  border-hover: "#bbb2a6"
  border-dashed: "#c8c2b8"
  skeleton: "#eee9e1"
  skeleton-deep: "#e8e2d9"
  success: "#2ea35f"
  success-text: "#1d7a44"
  success-tint: "#e9f7ee"
  success-console: "#8ed1a5"
  warning: "#e0a23c"
  warning-text: "#9a6b2f"
  warning-tint: "#fdf3e2"
  danger: "#d9534f"
  danger-text: "#a44836"
  danger-tint: "#fdeceb"
  danger-console: "#f2a08d"
  amber-tint: "#fdf8ef"
  amber-border: "#eee4d2"
  amber-text: "#9a7b3f"
  amber-title: "#7a6a4f"
  console-text: "#c3cdd2"
  console-dim: "#5d6d75"
  console-muted: "#8f9ba1"
  sidebar-text: "#b6c0c5"
  sidebar-faint: "#718087"
typography:
  display:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "24px（≥640px：30px）"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.045em"
  headline:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "18px（右栏区标题 20px）"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.03em"
  title:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "12–14px"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: '"Avenir Next", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "0.14em"
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
rounded:
  panel: "20px"
  dropzone: "16px"
  control: "12px"
  logo: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  panel:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.panel}"
    padding: "24px"
  field:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
  button-secondary:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.primary-text}"
  chip-selected:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-deep-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  chip-unselected:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  status-pill:
    backgroundColor: "{colors.primary-tint}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: OneLaunch · Selling Image Studio

## Overview

**Creative North Star: "暖纸上的生产线"（The Assembly Line on Warm Paper）**

整个系统是一间铺着暖色纸面的工作室：所有任务内容放在奶白大圆角面板上，像铺在纸面上的一叠卡纸；唯一强调色橙色 `#ef6a4c` 只留给"正在发生的事"——序号、选中态、主按钮、活动指示点，像生产线上的信号灯。而过程本身（思考日志、系统状态、导航骨架）沉入右侧与左侧的深墨 `#19232b` 世界，形成"暖纸工作区 × 深墨控制台"的稳定双世界对照。产品叙事是反黑盒的：提交之后一切都可见，视觉上则表现为日志逐行浮现、图片槽位逐格点亮。

密度中等偏高：正文以 11–14px 小字为主，层级靠字重（600/700/800）与字距收缩（负 tracking 标题、0.14em eyebrow）拉开，而非靠大字号。深度靠极淡的环境投影与描边表达，交互反馈靠颜色变化而非位移。

**Key Characteristics:**
- 双世界对照：暖纸工作区（`#f4f1eb` 底 + `#fffdf9` 面板）与深墨控制台（`#19232b`）分工明确
- 单一橙强调 `#ef6a4c`，无第二品牌色，无装饰性渐变
- 20px 大圆角 panel 与 12px field 是仅有的两个容器/控件原语
- 阴影只表达层级（面板、浮层、激活项），hover 一律用颜色变化回应
- 过程可视化动效：日志逐行浮现 + 生成槽位橙色扫描线
- 状态语言统一为"tint 底 + 深色文字 + 2px 圆点"胶囊

## Colors

调色盘由暖纸中性色、单一橙强调、深墨控制台色与四个语义状态色组成；所有颜色偏暖，从不出现冷纯灰。

### Primary
- **信号橙 Signal Orange** (`#ef6a4c`)：唯一强调色。用于区块序号（01/02/03）、主按钮、选中态描边与圆点、聚焦边框、活体指示点（`animate-pulse`）、侧栏 logo 块。全屏占比远低于 10%，稀有即语义。
- **深橙 Hover** (`#d95d41`)：主按钮与 hover 文字强调的按下层。
- **铁橙 Text** (`#c84f36`)：次级按钮 hover 文字、运行中胶囊文字、行内错误提示。
- **砖红 Selected** (`#b84934`)：选中 toggle 卡片上的文字色（配 `#fff1ed` 底）。
- **橙雾 Tint** (`#fff1ed`)：一切"被选中/进行中/错误提示"的浅橙底。
- **警示描边** (`#f0b7a8`)：错误横幅的边框色。

### Secondary
- **琥珀提示** (`#fdf8ef` 底 / `#eee4d2` 边 / `#9a7b3f` 文字 / `#f3e8d2` 徽章底)：右栏"视觉模型不可用（网关清单暂无可用视觉模型，质检降级人工复检）"这类降级说明专用，同系衍生色 `#7a6a4f`（标题）、`#9a8a68`（正文）。仅用于"能力受限"提示，不作通用强调；视觉质检正常可用时右栏渲染为与其他分组一致的模型选择器，不使用琥珀。

### Neutral — 暖纸工作区
- **暖纸底 Paper** (`#f4f1eb`)：应用根背景、body、页签容器底。
- **奶白 Cream** (`#fffdf9`)：所有 panel 与 field 的底色，头部栏同色。
- **浅纸 Deep Paper** (`#f8f5ef`)：右栏铁轨底、槽位占位底、上传热区底。
- **暖白 Bright** (`#fffaf3`)：侧栏激活项底色、深墨上的主文字色、`::selection` 文字色。
- **正文墨** (`#17202b`)：主文字，与橙构成唯一的前景对比 pair。
- **暖灰文字梯** (`#39342e` → `#514b43` → `#5e584f` → `#6f685e` → `#777168` → `#8d867c` → `#a49d92`)：由强到弱的七档暖灰。其中 `#5e584f`/`#6f685e`/`#777168` 为同档近似值（构建残留），新表面优先取 `#514b43`（标签）、`#6f685e`（次级）、`#8d867c`（说明）、`#a49d92`（占位符与 eyebrow 辅注）。
- **描边梯** (`#e2ddd5` 面板边 / `#d9d3c9` 控件边 / `#e8e2d9` 内嵌线 / `#bbb2a6` hover 边 / `#c8c2b8` 虚线上传框与滚动条)。
- **骨架占位** (`#eee9e1` / `#e8e2d9`)：加载骨架与空态图形底。

### Neutral — 深墨控制台
- **深墨 Ink** (`#19232b`)：侧栏与思考日志控制台独占底色。
- **浮层墨** (`#1f2b35`)：侧栏内弹出的目录浮层底。
- **控制台文字梯** (`#c3cdd2` 正文 / `#5d6d75` 时间戳与光标 / `#8f9ba1` 标签 / `#718087` 分区标签 / `#b6c0c5` 侧栏基础文字 / `#3d4c54` 闲置指示点)。
- **控制台语义** (`#8ed1a5` 成功行 / `#f2a08d` 失败行)：仅出现在日志行首 `✓`/`✗` 语义中。

### 语义状态（tint 底 + 深色文字 + 圆点三件套）
| 状态 | 圆点 | 文字 | tint 底 |
| --- | --- | --- | --- |
| 成功/已完成 | `#2ea35f` | `#1d7a44` | `#e9f7ee` |
| 部分/警告 | `#e0a23c` | `#9a6b2f` | `#fdf3e2` |
| 失败 | `#d9534f` | `#a44836` | `#fdeceb` |
| 运行中 | `#ef6a4c` + pulse | `#c84f36` | `#fff1ed` |

### Named Rules
**The 一橙原则 (The One Accent Rule).** `#ef6a4c` 是全系统唯一强调色，只授予"进行中或被选中"的元素；任何新表面不得引入第二品牌色、渐变填充或冷色强调。

**The 深墨分界 (The Ink Boundary Rule).** `#19232b` 深墨只属于"过程与系统"——侧栏、思考日志、系统状态；任务内容（商品、图片、表单）永远住在暖纸上。深墨不用于内容卡片。

## Typography

**Display/Body Font:** "Avenir Next" → "PingFang SC" → "Microsoft YaHei" → ui-sans-serif → system-ui（单栈，无衬线展示体，中文回退 PingFang/雅黑）
**Label/Console Font:** Tailwind 默认 mono 栈，仅用于思考日志控制台（11px）

**Character:** 系统无独立展示字体——个性全部来自字重与字距的手术：标题用 600/700 配 -0.02em～-0.045em 的紧字距制造"印刷标题"感，标签用 800 配 0.12–0.16em 的宽字距全大写制造"流水线铭牌"感。

### Hierarchy
- **Display** (600, 24px→30px @sm, -0.045em, #17202b)：每页唯一的页面主标题（头部栏 h1）。
- **Headline** (600, 18px/20px, -0.03em)：panel 区标题；固定以橙色序号前缀（`01`/`02`/`03` + 空格 + 标题）。
- **Title** (700, 14px)：panel 内小节标题（平台名、质检、详情页）。
- **Body** (400–500, 12–14px, leading-relaxed)：表单标签 12px/600，说明文字 12–14px/400。无长文场景，不做 65–75ch 约束。
- **Label/eyebrow** (800, 10px, 0.14em, 全大写, `#8b8479`)：空间命名铭牌（"ONE LAUNCH / IMAGE STUDIO"、"CREATE"）；侧栏深墨上同规格用 0.12–0.16em 字距配 `#8f9ba1`/`#718087`。
- **Mono 日志** (400, 11px, leading-relaxed)：时间戳 `#5d6d75` + 正文 `#c3cdd2`，成功行 `#8ed1a5`、失败行 `#f2a08d`。

### Named Rules
**The 序号即导航 (The Numbered Zone Rule).** 区块标题永远以橙色两位序号开头（01 参考图、02 商品资料、03 模型与调用），序号是世界的路标，不是装饰；新增区块必须进入这条序号链。

## Layout

应用骨架是三段式：**深墨侧栏（244px，<lg 隐藏）｜主内容区｜右栏铁轨（300px，<xl 隐藏）**。主区顶部是 88px 高的奶白页头（eyebrow + 主标题 + 圆角页签组），页头之下主区自滚动。

- **创作页三区**（`max-w-[1080px]` 居中）：`lg:grid-cols-[340px_1fr]` 双卡——01 参考图窄卡 + 02 商品资料宽卡，卡间距 `gap-5`（20px）；下方横向提交条 panel（调用计划说明 + 主按钮两端对齐）。
- **生成页网格**（`max-w-[1200px]` 居中）：顶部状态条 panel（胶囊 · 计数 · 耗时 · 新建任务按钮 `ml-auto`），主体 `xl:grid-cols-[1fr_330px]`——左侧按平台分组的槽位 panel（槽位 `grid-cols-2 sm:3 lg:5`，1:1 方形），右侧 330px 深墨思考日志台 `sticky top-4` + 商品画像折叠卡。
- **间距节奏**：6/8/12/16/20/24px 六档；panel 内边距 24px（紧凑场景 20px），panel 间距统一 20px。
- **响应式**：Tailwind 默认断点（sm 640 / md 768 / lg 1024 / xl 1280）。侧栏 lg 起出现、右栏 xl 起出现；移动端退化为单列 + 头部页签导航。

## Elevation & Depth

环境式弱投影系统：所有阴影都是大模糊、低透明度的"纸叠"暗示，从不出现硬偏移阴影。阴影表达**空间层级**（浮层 > 激活项 > 面板 > 页面底），不表达交互状态——hover 不抬升、不加深投影。

### Shadow Vocabulary
- **panel 环境影** (`0 12px 32px rgba(51,43,32,0.06)`)：所有奶白面板的常驻底影。
- **橙钮光晕** (`0 10px 20px rgba(239,106,76,0.22)`)：主按钮专属，disabled 时移除。
- **深墨台投影** (`0 12px 32px rgba(25,35,43,0.25)`)：思考日志控制台。
- **浮层影** (`0 18px 36px rgba(0,0,0,0.35)`)：侧栏目录弹层。
- **激活项影** (`0 8px 18px rgba(0,0,0,0.12–0.18)`)：深墨侧栏中激活项。
- **logo 光晕** (`0 8px 20px rgba(239,106,76,0.28)`)：侧栏 OL 方块。

### Named Rules
**The 色变不位变 (The Color-Response Rule).** 一切 hover/选中反馈只改变颜色（背景、文字、边框），禁止 translateY 位移、缩放或投影增强；动效预算留给日志浮现与扫描线。

## Shapes

圆角双主档 + 两特例：**容器 20px**（panel、深墨控制台、空态图标块），**控件 12px**（field、按钮、toggle 卡、槽位卡、内嵌编辑器），特例为**上传热区/深墨浮层 16px**（rounded-2xl）与**胶囊 999px**（状态 pill、徽章、次级示例按钮、移除钮）。侧栏 logo 方块为 14px。

描边是世界的笔触：面板 1px `#e2ddd5`、控件 1px `#d9d3c9`，上传热区是全系统唯一的虚线（1px dashed `#c8c2b8`）。深墨侧栏内部用 `white/10` 分隔线与 `white/8` hover 底替代描边。图片一律 `object-cover` 裁切进方形容器，底部压黑色渐变（`from-black/70`）承载标签。

## Components

原语只有两个：`.panel`（1px `#e2ddd5` 边 + 20px 圆角 + `#fffdf9` 底 + 环境影）与 `.field`（1px `#d9d3c9` 边 + 12px 圆角 + 12/14 内边距），其余组件均为二者的组合与变奏。

### Buttons
- **Shape:** 12px 圆角（次级胶囊钮例外，999px）。
- **Primary:** `#ef6a4c` 底 + 白字，`px-6 py-3.5`，14px/600，橙光晕投影；hover `#d95d41`；disabled `#c9c1b7` 无影。
- **Secondary:** `#fffdf9` 底 + 1px `#d9d3c9` 边 + `#5e584f` 字；hover 边框转橙、文字转 `#c84f36`。
- **覆盖式操作钮**（图片槽位内）：`black/65` 底白字小钮，hover 转 `#ef6a4c`；仅 hover/focus-within 时显形。

### Toggle 卡片（平台选择 / 语气选择）
- **选中:** 1px `#ef6a4c` 边 + `#fff1ed` 底 + `#b84934` 字 + 橙色 2px 圆点。
- **未选:** 1px `#e2ddd5` 边 + `#fffdf9` 底 + `#6f685e` 字 + `#d9d3c9` 圆点；hover 边转 `#bbb2a6`。

### Fields / Inputs
- **Style:** `.field` 原语；select 用 `.select-field` 隐藏原生箭头，右侧 13px 处内嵌 SVG 折线（`#776` 描边）。
- **Focus:** 边框转 `#ef6a4c`，底色提纯为 `#fff`，加 `0 0 0 4px rgba(239,106,76,0.1)` 橙环；全局 `:focus-visible` 为 3px `rgba(239,106,76,0.3)` outline，offset 2px。
- **Placeholder:** `#a49d92`。错误即时文案用 12px `#c84f36` 行内提示。

### Status Pill（状态胶囊）
`rounded-full px-3 py-1.5 text-xs font-bold`，tint 底 + 深色文字 + 前置 2px 圆点（运行中圆点 `animate-pulse`）。四态配色见 Colors · 语义状态表。

### 深墨思考日志台（Signature）
20px 圆角 `#19232b` 容器，头部 `white/10` 分隔线 + 0.12em 宽字距标题 + 右侧活体指示点（运行中橙点 pulse / 闲置 `#3d4c54`）；日志区 `font-mono text-[11px]`，每行 `log-line` 动画浮现，`✓`/`✗` 行首字符驱动语义色，底部 `▍` 光标，自动滚动到底。

### 槽位卡 Slot Card（Signature）
1:1 方形，12px 圆角，`#f8f5ef` 底。四态：**等待**（类型名 + "等待中"灰字）、**生成中**（三条错相橙色 shimmer 扫描线 + 底部灰字进度注）、**完成**（图片 + 底部黑色渐变标签带类型与尺寸）、**失败**（左上 `#d9534f` 胶囊）。hover 显出覆盖式"重新生成/修改"钮。

### Navigation
- **深墨侧栏:** 244px，分区 eyebrow 铭牌 + 13px 条目；激活项 `#fffaf3` 底 + `#19232b` 字 + 橙色图标块 + 激活影，hover `white/8`。
- **头部页签组:** `#f4f1eb` 底圆角容器内双页签，激活页签 `#19232b` 底白字 + `shadow-sm`，未激活 `#777168` 字 hover 转墨。

## Do's and Don'ts

### Do:
- **Do** 用 `.panel` + `.field` 两个原语组装一切新表面；容器 20px、控件 12px，不新增圆角档位。
- **Do** 给每个新区块编橙色序号（延续 01/02/03 链），eyebrow 铭牌命名空间。
- **Do** 用"tint 底 + 深色文字 + 2px 圆点"三件套表达一切状态；成功/警告/失败/运行中四色不得自造。
- **Do** 让过程可见：加载态用橙色 shimmer 扫描线与日志逐行浮现（`logIn` 240ms `cubic-bezier(0.16,1,0.3,1)`），拒绝静止 spinner 作为主流程反馈。
- **Do** 在深墨世界里用 `white/8`、`white/10` 做层与分隔，文字用 `#c3cdd2` 系；回到暖纸世界用描边梯。

### Don't:
- **Don't** 引入第二强调色、品牌渐变或冷灰（一切中性色必须偏暖）。
- **Don't** 用位移、缩放或投影增强做 hover 反馈——只许变色。
- **Don't** 把任务内容放进深墨面板，或把深墨只当装饰色使用（深墨 = 过程与系统）。
- **Don't** 新增 Unicode 字形当图标（现状侧栏的 `✦ □ ◒ ⌗` 等字形图标是构建遗留缺陷，待替换为真实图标，不得作为规则继承）；也不使用 emoji 做图标。
- **Don't** 大面积使用纯白 `#fff` 容器——容器是奶白 `#fffdf9`，纯白只出现在聚焦 field 与图片本体。
