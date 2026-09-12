// ===== 通用格式化与导出工具 =====
import type { RecordType } from '../types'

/** 有符号分数展示，如 +5 / -3 / 0 */
export function signedScore(n: number): string {
  if (n > 0) return `+${n}`
  return String(n)
}

export function recordTypeLabel(type: RecordType): string {
  switch (type) {
    case 'add':
      return '加分'
    case 'deduct':
      return '减分'
    case 'purchase':
      return '购买'
    case 'other':
      return '其他'
  }
}

/** 生成唯一 id */
export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** 转 CSV 文本（带 BOM，兼容 Excel 中文） */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = rows.map((r) => r.map(escape).join(','))
  return '\uFEFF' + lines.join('\r\n')
}
