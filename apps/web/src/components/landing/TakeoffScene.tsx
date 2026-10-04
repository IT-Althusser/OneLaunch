import { motion } from 'framer-motion';

/**
 * 首页底部「装货起飞」场景：跑道发丝线 + 五个图货箱 + 线稿货机（用户提供的简笔画图片）。
 * 图片为白底线稿，用 mix-blend-multiply 让白底隐形、跑道线可从机腹下方透出。
 * 装箱 / 滑跑 / 爬升的时间线由 LandingPage 通过 useAnimate 对 data-* 元素编排；
 * 本组件只负责静态结构与待命环境动效（机身浮动、跑道虚线缓流）。
 */

/** 五个货箱 = 五类图（点缀色与 tailwind type-* 同源） */
const CARGO = [
  { left: '7.5%', bottom: 26, dot: 'bg-type-white' },
  { left: '12.5%', bottom: 26, dot: 'bg-type-scene' },
  { left: '17.5%', bottom: 26, dot: 'bg-type-model' },
  { left: '10%', bottom: 58, dot: 'bg-type-compare' },
  { left: '15%', bottom: 58, dot: 'bg-type-size' },
];

/** 原图 2000×1125（16:9）：机腹下缘约在高度 62% 处，机身绘制区约占宽 4%–96% */
export function TakeoffScene({ takingoff }: { takingoff: boolean }) {
  return (
    <div data-stage className="relative mx-auto h-[190px] w-full max-w-5xl">
      {/* 爬升尾迹（起飞段描画，弧线末端抬高） */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1000 190" preserveAspectRatio="none" fill="none">
        <motion.path
          data-contrail
          initial={{ pathLength: 0, opacity: 0 }}
          d="M330 126 C 520 122 640 96 750 38 C 850 -14 940 -80 1040 -160"
          stroke="#0d0d0d"
          strokeOpacity="0.16"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* 货箱堆 */}
      {CARGO.map((box, i) => (
        <div
          key={i}
          data-cargo
          className="absolute h-7 w-7 rounded-[7px] border border-line-strong bg-white shadow-sm"
          style={{ left: box.left, bottom: box.bottom }}
        >
          <span className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full ${box.dot}`} />
        </div>
      ))}

      {/* 跑道：发丝线 + 缓流中线 + 端点标识 */}
      <div aria-hidden className="absolute inset-x-0 bottom-0">
        <div className="h-px w-full bg-line" />
        <svg className="absolute inset-x-0 bottom-[4px] h-2 w-full" preserveAspectRatio="none" viewBox="0 0 1000 8">
          <line x1="0" y1="4" x2="1000" y2="4" stroke="#dcdce3" strokeWidth="2" strokeDasharray="26 30" className="runway-dash" />
        </svg>
        <div className="absolute bottom-[-5px] left-0 h-3 w-px bg-line-strong" />
        <div className="absolute bottom-[-5px] right-0 h-3 w-px bg-line-strong" />
      </div>

      {/* 货机（用户线稿图，已预处理的透明 PNG：白底转 alpha、水印带裁除）。
          以机身最低点（发动机短舱下缘）贴住跑道线；data-door = 机身前舱门（装箱目标点） */}
      <div data-plane className="absolute bottom-[-2px] left-[31%] w-[280px]">
        <motion.div
          animate={takingoff ? { y: 0 } : { y: [0, -3, 0] }}
          transition={takingoff ? { duration: 0.2 } : { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img src="/plane.png" alt="" aria-hidden className="w-full select-none" draggable={false} />
        </motion.div>
        <div data-door className="pointer-events-none absolute" style={{ left: '79%', top: '45%', width: 2, height: 2 }} />
      </div>
    </div>
  );
}
