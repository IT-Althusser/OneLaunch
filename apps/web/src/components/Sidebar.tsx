import { useEffect, useRef, useState } from 'react';
import { IMAGE_TYPES, type WorkbenchTab } from '../types';

interface Tool { name: string; icon: string; tag?: string; /** 打开的单图工作台类型；空串 = 主流程入口 */ tool: string; }
const TOOLS: Tool[] = [
  { name: '五图套图生成', icon: '✦', tag: '主流程', tool: '' }, { name: '白底图生成', icon: '□', tool: '白底图' }, { name: '场景图生成', icon: '◒', tool: '场景图' }, { name: '模特图生成', icon: '◌', tool: '模特图' }, { name: '对比图生成', icon: '↔', tool: '对比图' }, { name: '尺寸图生成', icon: '⌗', tool: '尺寸图' }, { name: '图片本地化', icon: '⊙', tool: '本地化' }, { name: 'AI 详情页', icon: '✎', tool: '详情页' },
];

/** 目录面板的跳转入口：与 App 的两个页签一一对应 */
const SECTIONS: { id: WorkbenchTab; name: string; desc: string; icon: string }[] = [
  { id: 'create', name: '创作工作台', desc: '填写商品资料、添加参考图，发起生成', icon: '✎' },
  { id: 'studio', name: '生成工作台', desc: '实时查看五图生成过程，单图可改', icon: '✦' },
];

export function Sidebar({ apiOk, tab, activeTool, onNavigate, onOpenTool }: { apiOk: boolean | null; tab: WorkbenchTab; /** 当前打开的单图工具类型；空串 = 主流程（创作/生成工作台） */ activeTool: string; onNavigate: (tab: WorkbenchTab) => void; onOpenTool: (tool: string) => void }) {
  const [dirOpen, setDirOpen] = useState(false);
  const dirRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dirOpen) return;
    const onDown = (e: MouseEvent) => { if (dirRef.current && !dirRef.current.contains(e.target as Node)) setDirOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDirOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [dirOpen]);

  return <aside className="hidden w-[244px] shrink-0 flex-col bg-[#19232b] text-[#b6c0c5] lg:flex">
    <div className="border-b border-white/10 px-6 py-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#ef6a4c] text-sm font-black text-white shadow-[0_8px_20px_rgba(239,106,76,.28)]">OL</div><div><div className="text-[14px] font-semibold tracking-[-0.02em] text-[#fffaf3]">OneLaunch</div><div className="mt-0.5 text-[10px] font-medium tracking-[0.12em] text-[#8f9ba1]">SELLING IMAGE STUDIO</div></div></div></div>
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      <div ref={dirRef} className="mb-5">
        <button onClick={() => setDirOpen((open) => !open)} aria-expanded={dirOpen} aria-controls="workbench-directory" className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition ${dirOpen ? 'bg-white/8 text-white' : 'text-[#d7dedf] hover:bg-white/8'}`}><span className="text-base text-[#ef6a4c]">⌂</span>工作台<span className={`ml-auto text-[10px] text-[#8f9ba1] transition-transform duration-200 ${dirOpen ? 'rotate-180' : ''}`}>▾</span></button>
        {dirOpen && <div id="workbench-directory" className="panel-pop mt-2 rounded-2xl border border-white/10 bg-[#1f2b35] p-4 shadow-[0_18px_36px_rgba(0,0,0,.35)]">
          <div className="text-[10px] font-bold tracking-[0.16em] text-[#718087]">WORKBENCH · 详情介绍</div>
          <h3 className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[#fffaf3]">一键出海工作台</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-[#aeb9be]">跨境 AI 商品图片生成工作台：商品资料 + 参考图出发，AI 实时生成上架必备图，过程可见、单图可改。</p>
          <div className="mt-3">
            <div className="mb-1.5 text-[9px] font-bold tracking-[0.14em] text-[#718087]">点击图类，直达对应工作台</div>
            <div className="flex flex-wrap gap-1.5">{IMAGE_TYPES.map((t) => <button key={t} title={`打开${t}工作台`} onClick={() => { onOpenTool(t); setDirOpen(false); }} className="rounded-md bg-white/8 px-2 py-1 text-[10px] font-medium text-[#c3cdd1] transition hover:bg-[#ef6a4c] hover:text-white">{t}</button>)}</div>
          </div>
          <p className="mt-2.5 text-[10px] text-[#8f9ba1]">按 Amazon · TikTok Shop · Temu · Shopee 规范适配，白底图附人工复检提醒。</p>
          <div className="my-3.5 h-px bg-white/10" />
          <div className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#718087]">DIRECTORY · 快捷跳转</div>
          <div className="space-y-1">
            {SECTIONS.map((s) => {
              const active = tab === s.id;
              return <button key={s.id} onClick={() => { onNavigate(s.id); setDirOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${active ? 'bg-[#fffaf3] font-semibold text-[#19232b] shadow-[0_8px_18px_rgba(0,0,0,.18)]' : 'text-[#b6c0c5] hover:bg-white/8 hover:text-white'}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs ${active ? 'bg-[#ef6a4c] text-white' : 'bg-white/8 text-[#aab5b9]'}`}>{s.icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold">{s.name}</span><span className={`block truncate text-[10px] ${active ? 'text-[#6b645b]' : 'text-[#8f9ba1]'}`}>{s.desc}</span></span>
                {active && <span className="shrink-0 text-[9px] font-bold text-[#ef6a4c]">当前</span>}
              </button>;
            })}
          </div>
        </div>}
      </div>
      <div className="px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-[#718087]">CREATE</div><div className="mb-3 px-3 text-[12px] text-[#8f9ba1]">商品图片</div>
      <div className="space-y-1">{TOOLS.map((tool) => { const active = activeTool === tool.tool; return <button key={tool.name} title={tool.tool ? `打开${tool.name.replace(/生成$/, '')}工作台` : '回到创作工作台'} aria-pressed={active} onClick={() => { if (tool.tool) onOpenTool(tool.tool); else onNavigate('create'); }} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${active ? 'bg-[#fffaf3] font-semibold text-[#19232b] shadow-[0_8px_18px_rgba(0,0,0,.12)]' : 'text-[#b6c0c5] hover:bg-white/8 hover:text-white'}`}><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${active ? 'bg-[#ef6a4c] text-white' : 'bg-white/8 text-[#aab5b9]'}`}>{tool.icon}</span><span className="min-w-0 flex-1 truncate">{tool.name}</span>{tool.tag && <span className="text-[10px] text-[#ef6a4c]">{tool.tag}</span>}</button>; })}</div>
    </nav>
    <div className="border-t border-white/10 px-6 py-5 text-[11px] leading-relaxed text-[#8f9ba1]"><div className="mb-2 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${apiOk === false ? 'bg-[#f07d63]' : 'bg-[#8ed1a5]'}`} /><span className={apiOk === false ? 'text-[#f2a08d]' : 'text-[#a9d5b6]'}>{apiOk === false ? '后端未连接' : '服务已连接'}</span></div>OneLaunch · 场景一<br />AI 商品图片生成工作台</div>
  </aside>;
}
