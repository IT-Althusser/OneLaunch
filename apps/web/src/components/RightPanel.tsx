/**
 * 右栏：输出与模型配置面板
 * 03 · OUTPUT · MODEL
 * 输出规格选择 + 生成/质检模型展示 + 平台规范速览
 */

const SIZES = [
  { label: '1:1 方形展示', dim: '1024×1024', active: true },
  { label: '3:4 竖版', dim: '768×1024', active: false },
  { label: '9:16 竖屏', dim: '720×1280', active: false },
];

const MODELS = [
  { label: '生成模型', value: 'qwen/wan2.7-image-pro', hint: '同步调用 · 五图生成' },
  { label: '商品图理解', value: 'qwen/qwen3-vl-plus', hint: 'VL 模型 · 构建商品画像' },
  { label: '提示词设计', value: 'qwen/qwen3.7-max', hint: '文本模型 · 五图提示词' },
  { label: '质检模型', value: 'qwen/qwen3-vl-plus', hint: 'VL 模型 · 白底图复检' },
  { label: '本地化替换', value: 'qwen/wan2.5-i2i-preview', hint: '异步任务 · 图编辑' },
];

const PLATFORM_SPECS = [
  { platform: 'Amazon', spec: '纯白底 · 商品 ≥85% · 无水印' },
  { platform: 'TikTok Shop', spec: '竖版 · 色彩明快 · 场景感' },
  { platform: 'Temu', spec: '性价比 · 细节 · 卖点直给' },
  { platform: 'Shopee', spec: '主体清晰 · 移动端优化' },
];

export function RightPanel() {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white px-4 py-5">
      {/* 标题 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
            03 · OUTPUT · MODEL
          </div>
          <h2 className="mt-0.5 text-sm font-bold text-slate-800">输出与模型</h2>
        </div>
        <span className="text-[10px] text-slate-400">提交前确认</span>
      </div>

      {/* 输出规格 */}
      <div className="mb-5">
        <label className="mb-2 block text-xs font-medium text-slate-500">
          输出规格
        </label>
        <div className="space-y-2">
          {SIZES.map((s) => (
            <div
              key={s.dim}
              className={`rounded-lg border p-2.5 transition-colors ${
                s.active
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    s.active ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {s.label}
                </span>
                <span className="text-[10px] text-slate-400">{s.dim}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400">选择最终投放画幅</p>
      </div>

      {/* 模型配置 */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-slate-500">模型配置</label>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
            可切换
          </span>
        </div>
        <div className="space-y-2">
          {MODELS.map((m) => (
            <div
              key={m.value}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"
            >
              <div className="text-[10px] text-slate-500">{m.label}</div>
              <div className="mt-0.5 break-all text-xs font-bold text-emerald-700">
                {m.value}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">{m.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 平台规范速览 */}
      <div className="mb-5">
        <label className="mb-2 block text-xs font-medium text-slate-500">
          平台规范速览
        </label>
        <div className="space-y-1.5">
          {PLATFORM_SPECS.map((p) => (
            <div
              key={p.platform}
              className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
            >
              <span className="w-[76px] shrink-0 text-[11px] font-bold text-slate-700">
                {p.platform}
              </span>
              <span className="text-[10px] leading-relaxed text-slate-500">
                {p.spec}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 模型分层降本提示 */}
      <div className="rounded-lg bg-slate-900 p-3 text-[10px] leading-relaxed text-slate-400">
        <span className="font-bold text-emerald-400">模型分层降本</span>
        <br />
        flash 粗筛 → plus 精检 → max 定稿，遵循官方「先小模型原型验证再切高性能模型」路径。
      </div>
    </aside>
  );
}
