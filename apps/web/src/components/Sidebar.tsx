/**
 * 深色侧边栏 — 品牌区 + 编号工具列表 + 本机空间
 * 布局参考：左侧固定 200px，深色背景，工具按 01-07 编号
 */

interface Tool {
  num: string;
  name: string;
  icon: string;
  tag?: string;
}

const TOOLS: Tool[] = [
  { num: '01', name: '五图套图生成', icon: '五', tag: 'CORE' },
  { num: '02', name: '白底图生成', icon: '白' },
  { num: '03', name: '场景图生成', icon: '场' },
  { num: '04', name: '模特图生成', icon: '模' },
  { num: '05', name: '对比图生成', icon: '对' },
  { num: '06', name: '尺寸图生成', icon: '尺' },
  { num: '07', name: '图片本地化', icon: '地' },
];

export function Sidebar({ apiOk }: { apiOk: boolean | null }) {
  return (
    <aside className="flex w-[200px] shrink-0 flex-col bg-[#0a0f0e] text-slate-400">
      {/* 品牌区 */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-[13px] font-extrabold text-white">
          OL
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight text-white">
            OneLaunch 一键出海
          </div>
          <div className="text-[9px] font-semibold tracking-[.12em] text-slate-500">
            AI IMAGE WORKBENCH
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {/* 工作台首页 */}
        <button className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-[11px]">
            ▦
          </span>
          工作台首页
        </button>

        {/* 内容创作分区 */}
        <div className="px-2.5 pb-1 pt-4 text-[10px] font-bold tracking-[.12em] text-slate-600">
          内容创作
        </div>
        <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500">
          <span className="text-[10px]">▸</span>
          AI 商品图片生成
        </div>

        {/* 编号工具列表 */}
        <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold tracking-[.12em] text-slate-600">
          TOOLS
        </div>
        {TOOLS.map((tool, i) => (
          <button
            key={tool.num}
            className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
              i === 0
                ? 'border-l-2 border-emerald-500 bg-emerald-500/10 font-bold text-emerald-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] ${
                i === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5'
              }`}
            >
              {tool.icon}
            </span>
            <span className="min-w-0 truncate">{tool.name}</span>
            {tool.tag && (
              <span className="ml-auto text-[9px] font-bold text-emerald-500">
                {tool.tag}
              </span>
            )}
          </button>
        ))}

        {/* 本机空间分区 */}
        <div className="px-2.5 pb-1 pt-4 text-[10px] font-bold tracking-[.12em] text-slate-600">
          本机空间
        </div>
        <button className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-400 transition-colors hover:bg-white/5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-[11px]">
            ▤
          </span>
          商品项目
          <span className="ml-auto text-[10px] text-slate-600">0</span>
        </button>
        <button className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-slate-400 transition-colors hover:bg-white/5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-[11px]">
            ◷
          </span>
          任务中心
          <span className="ml-auto text-[10px] text-slate-600">0</span>
        </button>
      </nav>

      {/* 底部：连接状态 + 赛事信息 */}
      <div className="border-t border-white/5 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              apiOk === false ? 'bg-red-400' : 'bg-emerald-400'
            }`}
          />
          <span className={apiOk === false ? 'text-red-300' : 'text-emerald-300'}>
            {apiOk === false ? '后端未连接' : '后端已连接'}
          </span>
        </div>
        场景一 · AI 智能上新
        <br />
        方向：AI 商品图片生成
      </div>
    </aside>
  );
}
