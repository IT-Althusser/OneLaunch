interface Tool { name: string; icon: string; tag?: string; }
const TOOLS: Tool[] = [
  { name: '五图套图生成', icon: '✦', tag: '主流程' }, { name: '白底图生成', icon: '□' }, { name: '场景图生成', icon: '◒' }, { name: '模特图生成', icon: '◌' }, { name: '对比图生成', icon: '↔' }, { name: '尺寸图生成', icon: '⌗' }, { name: '图片本地化', icon: '⊙' },
];

export function Sidebar({ apiOk }: { apiOk: boolean | null }) {
  return <aside className="hidden w-[244px] shrink-0 flex-col bg-[#19232b] text-[#b6c0c5] lg:flex">
    <div className="border-b border-white/10 px-6 py-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#ef6a4c] text-sm font-black text-white shadow-[0_8px_20px_rgba(239,106,76,.28)]">OL</div><div><div className="text-[14px] font-semibold tracking-[-0.02em] text-[#fffaf3]">OneLaunch</div><div className="mt-0.5 text-[10px] font-medium tracking-[0.12em] text-[#8f9ba1]">SELLING IMAGE STUDIO</div></div></div></div>
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      <button className="mb-5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-[#d7dedf] transition hover:bg-white/8"><span className="text-base text-[#ef6a4c]">⌂</span>工作台</button>
      <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-[#718087]">CREATE</div><div className="mb-3 px-3 text-[12px] text-[#8f9ba1]">商品图片</div>
      <div className="space-y-1">{TOOLS.map((tool, i) => <button key={tool.name} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${i === 0 ? 'bg-[#fffaf3] font-semibold text-[#19232b] shadow-[0_8px_18px_rgba(0,0,0,.12)]' : 'text-[#b6c0c5] hover:bg-white/8 hover:text-white'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${i === 0 ? 'bg-[#ef6a4c] text-white' : 'bg-white/8 text-[#aab5b9]'}`}>{tool.icon}</span><span className="min-w-0 flex-1 truncate">{tool.name}</span>{tool.tag && <span className="text-[10px] text-[#ef6a4c]">{tool.tag}</span>}</button>)}</div>
    </nav>
    <div className="border-t border-white/10 px-6 py-5 text-[11px] leading-relaxed text-[#8f9ba1]"><div className="mb-2 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${apiOk === false ? 'bg-[#f07d63]' : 'bg-[#8ed1a5]'}`} /><span className={apiOk === false ? 'text-[#f2a08d]' : 'text-[#a9d5b6]'}>{apiOk === false ? '后端未连接' : '服务已连接'}</span></div>OneLaunch · 场景一<br />AI 商品图片生成工作台</div>
  </aside>;
}
