/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 墨色三级 + 极浅底（OpenAI/Apple 式克制中性）
        ink: { DEFAULT: '#0d0d0d', soft: '#2d2d33', mid: '#5d5d6b', mute: '#8e8e9a', faint: '#b4b4bf' },
        line: { DEFAULT: '#e9e9ee', strong: '#dcdce3' },
        mist: '#f7f7f8',
        // 语义状态
        ok: '#0ea472',
        warn: '#d97706',
        bad: '#dc2626',
        run: '#3b82f6',
        // 五类图专属点缀（仅小圆点 / 标签，不做大面积色块）
        type: { white: '#10b981', scene: '#0ea5e9', model: '#f43f5e', compare: '#f59e0b', size: '#8b5cf6' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Consolas', '"Cascadia Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(13,13,16,.04), 0 12px 32px rgba(13,13,16,.05)',
        pop: '0 2px 8px rgba(13,13,16,.07), 0 24px 56px rgba(13,13,16,.10)',
      },
    },
  },
  plugins: [],
};
