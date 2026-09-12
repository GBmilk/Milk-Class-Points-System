// ===== 拼音工具（基于 pinyin-pro） =====
import { pinyin } from 'pinyin-pro'

/** 生成姓名拼音全拼（用于排序），非中文原样保留 */
export function pinyinFull(name: string): string {
  try {
    return pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join(' ').toLowerCase()
  } catch {
    return name.toLowerCase()
  }
}

/** 获取第一个字符的拼音首字母（用于小组首字等） */
export function pinyinFirst(name: string): string {
  if (!name) return '?'
  const ch = name.charAt(0)
  try {
    const p = pinyin(ch, { pattern: 'first', toneType: 'none', nonZh: 'consecutive' })
    if (p && p !== ch) return p.charAt(0).toUpperCase()
  } catch {
    // 忽略
  }
  return ch.toUpperCase()
}
