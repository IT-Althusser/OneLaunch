import { useRef, useState, type CSSProperties } from 'react';
import { motion, useAnimate, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { TakeoffScene } from './TakeoffScene';

/** 右侧漂浮示例卡：三张极简线稿商品示意（纯 CSS/SVG，无真实素材依赖） */
function SampleCards() {
  return (
    <div className="absolute right-[5%] top-[14%] hidden w-[380px] lg:block" aria-hidden>
      <div className="relative h-[360px]">
        {/* 白底图 */}
        <div data-sample className="hero-in absolute right-[210px] top-[30px] w-44 rotate-[-6deg]" style={{ '--hero-delay': '0.3s' } as CSSProperties}>
          <div className="rounded-2xl border border-line bg-white p-2.5 shadow-card">
            <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-line bg-white">
              <svg viewBox="0 0 80 80" className="h-20 w-20" fill="none" stroke="#0d0d0d" strokeWidth="1.8" strokeLinejoin="round">
                <path d="M24 30 L28 68 L52 68 L56 30" />
                <path d="M32 30 C32 18 48 18 48 30" />
                <path d="M24 38 L56 38" strokeOpacity="0.35" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 px-1 pt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-type-white" />
              <span className="text-[10px] font-semibold text-ink-mute">白底图</span>
            </div>
          </div>
        </div>
        {/* 场景图 */}
        <div data-sample className="hero-in absolute right-[60px] top-[0px] w-44 rotate-[3deg]" style={{ '--hero-delay': '0.4s' } as CSSProperties}>
          <div className="rounded-2xl border border-line bg-white p-2.5 shadow-card">
            <div className="flex aspect-[4/5] items-end justify-center rounded-xl bg-gradient-to-b from-mist to-[#e8edf4] pb-6">
              <svg viewBox="0 0 80 60" className="h-20 w-24" fill="none" stroke="#0d0d0d" strokeWidth="1.8" strokeLinejoin="round">
                <path d="M12 50 L68 50" />
                <path d="M22 50 L22 34 L46 34 L46 50" />
                <path d="M34 34 L34 24 M30 24 L38 24" />
                <circle cx="58" cy="40" r="6" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 px-1 pt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-type-scene" />
              <span className="text-[10px] font-semibold text-ink-mute">场景图</span>
            </div>
          </div>
        </div>
        {/* 模特图 */}
        <div data-sample className="hero-in absolute right-[135px] top-[195px] w-44 rotate-[-2deg]" style={{ '--hero-delay': '0.5s' } as CSSProperties}>
          <div className="rounded-2xl border border-line bg-white p-2.5 shadow-card">
            <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-mist">
              <svg viewBox="0 0 80 80" className="h-20 w-20" fill="none" stroke="#0d0d0d" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
                <circle cx="40" cy="22" r="9" />
                <path d="M22 68 C22 50 30 44 40 44 C50 44 58 50 58 68" />
                <path d="M40 44 L40 56" />
              </svg>
            </div>
            <div className="flex items-center gap-1.5 px-1 pt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-type-model" />
              <span className="text-[10px] font-semibold text-ink-mute">模特图</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 落地页（签名场景）：待命机场 → 点击「开始创作！」→ 装货（五图入舱）→ 滑跑加速 →
 * 抬头爬升离屏，CTA 经共享布局变形为外壳侧边栏「五图一键生成」项，外壳浮出展开。
 * 时间线约 2.6s；期间点击任意处可跳过；prefers-reduced-motion 直接进入。
 */
export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [scope, animate] = useAnimate();
  const reduced = useReducedMotion();
  const [takingoff, setTakingoff] = useState(false);
  const enteredRef = useRef(false);

  function enter() {
    if (enteredRef.current) return;
    enteredRef.current = true;
    onEnter();
  }

  function start() {
    if (takingoff || enteredRef.current) return;
    if (reduced) { enter(); return; }
    setTakingoff(true);
    const root = scope.current as HTMLElement;
    const stage = root.querySelector('[data-stage]') as HTMLElement;
    const stageW = stage?.clientWidth ?? 900;

    // 1) 装货：五个货箱沿弧线依次飞入货舱门（每箱入舱时机身下沉一次，重量感）
    const door = root.querySelector('[data-door]') as HTMLElement;
    if (door) {
      const dr = door.getBoundingClientRect();
      root.querySelectorAll<HTMLElement>('[data-cargo]').forEach((box, i) => {
        const r = box.getBoundingClientRect();
        const dx = dr.left + dr.width / 2 - (r.left + r.width / 2);
        const dy = dr.top + dr.height / 2 - (r.top + r.height / 2);
        animate(box,
          { x: [0, dx * 0.55, dx], y: [0, -46, dy], scale: [1, 0.92, 0.22], opacity: [1, 1, 0] },
          { delay: 0.1 + i * 0.11, duration: 0.52, ease: [0.45, 0, 0.25, 1], times: [0, 0.55, 1] });
      });
      animate('[data-plane]', { y: 3 }, { delay: 0.66, duration: 0.16 });
    }

    // 2) 文案向左滑出 + 边缘模糊；示例卡淡出（草图第一段动画，发生在滑跑同时）
    animate('[data-exit-left]',
      { x: -Math.max(420, window.innerWidth * 0.5), opacity: 0, filter: 'blur(14px)' },
      { delay: 0.8, duration: 0.75, ease: [0.55, 0, 0.85, 0.36] });
    animate('[data-sample]', { opacity: 0, y: -22, scale: 0.95 }, { delay: 0.8, duration: 0.5 });

    // 3) 滑跑加速（ease-in）→ 抬头 → 大角度爬升离屏，尾迹同步描画
    animate('[data-plane]', { x: stageW * 0.16, y: 0 }, { delay: 0.9, duration: 0.82, ease: [0.6, 0, 0.85, 0.4] });
    animate('[data-plane]', { rotate: -12 }, { delay: 1.66, duration: 0.6, ease: 'easeOut' });
    animate('[data-contrail]', { pathLength: 1, opacity: 1 }, { delay: 1.66, duration: 1.05, ease: 'easeOut' });
    animate('[data-plane]',
      { x: stageW * 0.62, y: -Math.max(620, window.innerHeight * 0.9), scale: 0.42 },
      { delay: 1.74, duration: 1.05, ease: [0.3, 0.35, 0.1, 1] });

    // 4) 外壳入场与飞机离场交叠（CTA→侧边栏项的共享布局变形在此时发生）
    window.setTimeout(enter, 2350);
    window.setTimeout(enter, 3400); // 兜底：动画链路异常时也保证进入
  }

  return (
    <motion.div
      ref={scope}
      exit={{ opacity: 0, transition: { delay: 0.4, duration: 0.45 } }}
      onClick={takingoff ? enter : undefined}
      title={takingoff ? '点击任意处跳过动画' : undefined}
      className="relative flex min-h-screen flex-col overflow-hidden bg-white"
    >
      {/* 顶部环境微光 */}
      <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 h-[460px] w-[860px] -translate-x-1/2 rounded-full bg-mist blur-3xl" />

      <SampleCards />

      {/* 主文案区 */}
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-10 pt-28">
        <span data-exit-left className="hero-in inline-flex w-fit items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-ink-mid shadow-card" style={{ '--hero-delay': '0.05s' } as CSSProperties}>
          <Sparkles className="h-3.5 w-3.5 text-ink" />
          五图一键生成
        </span>
        <h1 data-exit-left className="hero-in mt-7 text-[44px] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[56px] md:text-[64px]" style={{ '--hero-delay': '0.12s' } as CSSProperties}>
          把新品
          <br />
          做成一套上架的图
        </h1>
        <div data-exit-left className="hero-in mt-6 space-y-1 text-[15px] leading-relaxed text-ink-mid" style={{ '--hero-delay': '0.2s' } as CSSProperties}>
          <p>一键生成 <span className="mx-1 text-ink-faint">→</span> 便捷</p>
          <p>检验过程 <span className="mx-1 text-ink-faint">→</span> 透明</p>
        </div>
        <motion.button
          type="button"
          layoutId="nav-primary"
          onClick={(e) => { e.stopPropagation(); start(); }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="btn-primary mt-10 w-fit px-8 py-4 text-base"
        >
          开始创作！
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>

      {/* 底部跑道装货场景 */}
      <div className="relative pb-8">
        <TakeoffScene takingoff={takingoff} />
      </div>
    </motion.div>
  );
}
