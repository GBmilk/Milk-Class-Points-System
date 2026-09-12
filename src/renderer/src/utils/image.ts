// ===== 图片处理工具 =====

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败，请更换图片'))
    img.src = src
  })
}

export interface CompressOptions {
  /** 最大边长（像素） */
  maxSize: number
  /** JPEG 质量 0-1 */
  quality: number
  /** 允许的最大输入大小（字节） */
  maxInputBytes?: number
}

/** 压缩图片并返回 dataURL（限制大小，避免撑爆本地存储） */
export async function compressImageFile(file: File, opts: CompressOptions): Promise<string> {
  const maxInput = opts.maxInputBytes ?? 10 * 1024 * 1024
  if (file.size > maxInput) {
    throw new Error(`图片过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于 ${Math.round(maxInput / 1024 / 1024)}MB 的图片`)
  }
  const dataUrl = await readFileAsDataURL(file)
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, opts.maxSize / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  // 小体积 PNG 保留透明通道，其余转 JPEG
  const keepPng = file.type === 'image/png' && file.size <= 300 * 1024
  const out = canvas.toDataURL(keepPng ? 'image/png' : 'image/jpeg', opts.quality)
  if (out.length > 900 * 1024) {
    // 仍然过大时降低质量重试一次
    return canvas.toDataURL('image/jpeg', 0.6)
  }
  return out
}

export const AVATAR_SIZE = 256
export const PRODUCT_IMG_SIZE = 512
export const HONOR_IMG_SIZE = 900
export const BACKGROUND_IMG_SIZE = 1920
