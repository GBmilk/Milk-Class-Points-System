// ===== 软件图标（Logo）解析 =====
// 图标优先使用用户在「系统设置 → 外观设置」中选择的本地 PNG 文件；
// 未设置时回退到班级头像；都没有时使用随应用打包的内置牛奶图标 PNG。
import milkLogo from '../assets/milk-logo.png'
import type { SystemSettings } from '../types'

/** 内置的本地牛奶图标（PNG 资源，随应用打包，离线可用） */
export const DEFAULT_MILK_LOGO = milkLogo

/** 解析当前应显示的软件图标地址 */
export function resolveAppLogo(settings: Pick<SystemSettings, 'appLogo' | 'classAvatar'>): string {
  return settings.appLogo || settings.classAvatar || milkLogo
}
