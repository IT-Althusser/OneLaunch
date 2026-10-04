import { useEffect, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { LandingPage } from './components/landing/LandingPage';
import { AppShell } from './components/shell/AppShell';
import { useModelCatalog } from './hooks/useModelCatalog';
import type { AppPhase } from './types';

/*
 * 方向契约（2026-10 前端重构：极简中性 + 出海起飞）
 * THESIS: 输入商品与参考图 → 五图在生产线上实时成形，过程全程可见、单图可返工——拒绝"提交后黑盒等待"的表单工具范式。
 * OWN-WORLD: 白底 #ffffff、雾底 #f7f7f8、墨色 #0d0d0d 三级文字、发丝边框 #e9e9ee；主按钮纯黑胶囊（OpenAI/Apple 式）；
 * 五类图各配一枚点缀色小圆点。唯一签名元素：首页「装货起飞」——五个图货箱装入极简线条货机，滑跑爬升离屏，
 * 尾迹衔接顶栏进度条，CTA 经共享布局变形为侧边栏「五图一键生成」项。
 * STORY: 落地页待命机场 → 开始创作 → 三步向导（参考图 / 商品资料+AI润色 / 模型调用）→ 生成工作台
 * 五图槽位逐格点亮，右侧「思考/检查」双卡堆叠；侧栏工具直开单图工作台整页细改，工作台 hub 收纳本地化/合规/详情页。
 * PROTECTED: StudioView 与工具工作台实例隐藏不卸载（后台任务连续性）；SSE 手写解析与槽位序号机制不变。
 */
export default function App() {
  const [phase, setPhase] = useState<AppPhase>('landing');
  const { catalog, selection, setSelection, error } = useModelCatalog();
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => setApiOk(r.ok)).catch(() => setApiOk(false));
  }, []);

  return (
    <LayoutGroup>
      <AnimatePresence>
        {phase === 'landing' ? (
          <LandingPage key="landing" onEnter={() => setPhase('app')} />
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="min-h-screen bg-white text-ink"
          >
            <AppShell
              catalog={catalog}
              selection={selection}
              onSelectionChange={setSelection}
              catalogError={error}
              apiOk={apiOk}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
