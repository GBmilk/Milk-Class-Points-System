// ===== 主题系统：14 套主题 + 深色模式 + 自定义背景 =====

export interface ThemeDef {
  id: string
  name: string
  /** 主色（Element Plus 主色） */
  primary: string
  /** 渐变起止色 */
  gradient: [string, string]
}

export const THEMES: ThemeDef[] = [
  { id: 'sky-blue-gradient', name: '浅蓝渐变', primary: '#3b82f6', gradient: ['#60a5fa', '#2563eb'] },
  { id: 'sky-blue', name: '天空蓝', primary: '#38bdf8', gradient: ['#7dd3fc', '#0284c7'] },
  { id: 'mint-green', name: '薄荷绿', primary: '#10b981', gradient: ['#6ee7b7', '#059669'] },
  { id: 'fresh-cyan', name: '清新青', primary: '#14b8a6', gradient: ['#5eead4', '#0d9488'] },
  { id: 'sakura-pink', name: '樱花粉', primary: '#f472b6', gradient: ['#f9a8d4', '#db2777'] },
  { id: 'lavender', name: '薰衣草紫', primary: '#8b5cf6', gradient: ['#c4b5fd', '#7c3aed'] },
  { id: 'lemon-yellow', name: '柠檬黄', primary: '#eab308', gradient: ['#fde047', '#ca8a04'] },
  { id: 'vivid-orange', name: '活力橙', primary: '#f97316', gradient: ['#fdba74', '#ea580c'] },
  { id: 'coral-red', name: '珊瑚红', primary: '#f43f5e', gradient: ['#fda4af', '#e11d48'] },
  { id: 'lake-blue', name: '湖水蓝', primary: '#06b6d4', gradient: ['#67e8f9', '#0891b2'] },
  { id: 'forest-green', name: '森林绿', primary: '#22c55e', gradient: ['#86efac', '#16a34a'] },
  { id: 'deep-sea', name: '深海蓝', primary: '#1d4ed8', gradient: ['#60a5fa', '#1e3a8a'] },
  { id: 'star-purple', name: '星空紫', primary: '#6d28d9', gradient: ['#a78bfa', '#4c1d95'] },
  { id: 'warm-gold', name: '暖阳金', primary: '#f59e0b', gradient: ['#fcd34d', '#d97706'] }
]

export function getThemeById(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(hex1: string, hex2: string, ratio: number): string {
  const a = hexToRgb(hex1)
  const b = hexToRgb(hex2)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * ratio))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** 应用主题、深浅模式与自定义背景到根节点 CSS 变量（不刷新页面） */
export function applyTheme(themeId: string, mode: 'light' | 'dark' | 'system', backgroundImage: string | null): void {
  const theme = getThemeById(themeId)
  const root = document.documentElement
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)

  // Element Plus 主色系
  root.style.setProperty('--el-color-primary', theme.primary)
  root.style.setProperty('--el-color-primary-light-3', mix(theme.primary, '#ffffff', 0.3))
  root.style.setProperty('--el-color-primary-light-5', mix(theme.primary, '#ffffff', 0.5))
  root.style.setProperty('--el-color-primary-light-7', mix(theme.primary, '#ffffff', 0.7))
  root.style.setProperty('--el-color-primary-light-8', mix(theme.primary, '#ffffff', 0.8))
  root.style.setProperty('--el-color-primary-light-9', mix(theme.primary, '#ffffff', 0.9))
  root.style.setProperty('--el-color-primary-dark-2', mix(theme.primary, '#000000', 0.2))

  // 应用自定义主题变量
  root.style.setProperty('--app-primary', theme.primary)
  root.style.setProperty('--app-grad-a', theme.gradient[0])
  root.style.setProperty('--app-grad-b', theme.gradient[1])

  // 侧边栏
  const sidebarBg = dark ? mix(theme.gradient[1], '#0b1220', 0.72) : mix(theme.gradient[1], '#ffffff', 0.88)
  root.style.setProperty('--app-sidebar-bg', sidebarBg)
  root.style.setProperty('--app-sidebar-text', dark ? 'rgba(255,255,255,0.92)' : '#1f2d3d')
  root.style.setProperty('--app-sidebar-active', dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.92)')

  // 页面背景（图片或渐变）
  if (backgroundImage) {
    root.style.setProperty('--app-bg-image', `url("${backgroundImage}")`)
    root.style.setProperty('--app-bg-mode', 'image')
  } else {
    root.style.setProperty('--app-bg-image', 'none')
    root.style.setProperty('--app-bg-mode', 'gradient')
  }

  if (dark) {
    root.style.setProperty('--app-bg-gradient', 'linear-gradient(160deg, #0d1526, #141d33)')
    root.style.setProperty('--app-bg-overlay', 'rgba(8, 12, 24, 0.72)')
  } else {
    root.style.setProperty(
      '--app-bg-gradient',
      `linear-gradient(160deg, ${mix(theme.gradient[0], '#ffffff', 0.84)}, ${mix(theme.gradient[1], '#ffffff', 0.92)})`
    )
    root.style.setProperty('--app-bg-overlay', 'rgba(255, 255, 255, 0.78)')
  }

  // 文字与卡片
  if (dark) {
    root.style.setProperty('--app-text', '#e5eaf3')
    root.style.setProperty('--app-text-secondary', '#9aa5b8')
    root.style.setProperty('--app-card-bg', 'rgba(23,32,54,0.78)')
    root.style.setProperty('--app-card-border', 'rgba(255,255,255,0.08)')
  } else {
    root.style.setProperty('--app-text', '#1f2d3d')
    root.style.setProperty('--app-text-secondary', '#6b7688')
    root.style.setProperty('--app-card-bg', 'rgba(255,255,255,0.82)')
    root.style.setProperty('--app-card-border', 'rgba(255,255,255,0.65)')
  }
}
