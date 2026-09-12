// 应用图标生成脚本：使用纯 Node 实现 PNG/ICO 编码，无需额外依赖
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(root, 'build'), { recursive: true })

// ---------- PNG 编码 ----------
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // 颜色类型 RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // 过滤类型 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

// ---------- 形状 SDF 工具 ----------
function sdRoundRect(px, py, x0, y0, x1, y1, r) {
  const qx = Math.abs(px - (x0 + x1) / 2) - (x1 - x0) / 2 + r
  const qy = Math.abs(py - (y0 + y1) / 2) - (y1 - y0) / 2 + r
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}
function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r
}
// 三角形 SDF（精确）：内部为负、外部为正
function sdTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const segDist2 = (x1, y1, x2, y2) => {
    const ex = x2 - x1
    const ey = y2 - y1
    const wx = px - x1
    const wy = py - y1
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
    const dx = wx - ex * t
    const dy = wy - ey * t
    return dx * dx + dy * dy
  }
  const cross = (x1, y1, x2, y2) => (x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)
  const c1 = cross(ax, ay, bx, by)
  const c2 = cross(bx, by, cx, cy)
  const c3 = cross(cx, cy, ax, ay)
  const hasNeg = c1 < 0 || c2 < 0 || c3 < 0
  const hasPos = c1 > 0 || c2 > 0 || c3 > 0
  const dist = Math.sqrt(Math.min(segDist2(ax, ay, bx, by), segDist2(bx, by, cx, cy), segDist2(cx, cy, ax, ay)))
  return hasNeg && hasPos ? dist : -dist
}
function lerp(a, b, t) {
  return a + (b - a) * t
}
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
const alpha = (d) => clamp01(0.5 - d)

// ---------- 渲染器：3x3 超采样 + 正确的 alpha 合成（source over） ----------
/**
 * @param {number} S 输出边长
 * @param {number} designSize 设计坐标系边长
 * @param {(X:number, Y:number, put:(color:number[], coverage:number)=>void)=>void} shade 逐点绘制
 */
function renderPixels(S, designSize, shade) {
  const SS = 3
  const n = SS * SS
  const accR = new Float64Array(S * S)
  const accG = new Float64Array(S * S)
  const accB = new Float64Array(S * S)
  const accA = new Float64Array(S * S)
  const k = designSize / S
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let sr = 0
      let sg = 0
      let sb = 0
      let sa = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const X = (x + (sx + 0.5) / SS) * k
          const Y = (y + (sy + 0.5) / SS) * k
          let r = 0
          let g = 0
          let b = 0
          let a = 0
          const put = (color, coverage) => {
            if (coverage <= 0.003) return
            const na = coverage + a * (1 - coverage)
            if (na <= 0) return
            r = (color[0] * coverage + r * a * (1 - coverage)) / na
            g = (color[1] * coverage + g * a * (1 - coverage)) / na
            b = (color[2] * coverage + b * a * (1 - coverage)) / na
            a = na
          }
          shade(X, Y, put)
          sr += r * a
          sg += g * a
          sb += b * a
          sa += a
        }
      }
      if (sa <= 0.004 * n) continue
      const i = y * S + x
      accR[i] = sr / sa
      accG[i] = sg / sa
      accB[i] = sb / sa
      accA[i] = sa / n
    }
  }
  const out = Buffer.alloc(S * S * 4)
  for (let i = 0; i < S * S; i++) {
    const a = clamp01(accA[i])
    if (a <= 0.004) {
      out[i * 4 + 3] = 0
      continue
    }
    out[i * 4] = Math.round(clamp01(accR[i] / 255) * 255)
    out[i * 4 + 1] = Math.round(clamp01(accG[i] / 255) * 255)
    out[i * 4 + 2] = Math.round(clamp01(accB[i] / 255) * 255)
    out[i * 4 + 3] = Math.round(a * 255)
  }
  return out
}

// ---------- 应用图标绘制（蓝色渐变底 + 白色奶盒） ----------
const C = {
  bgTop: [127, 196, 255],
  bgBottom: [53, 104, 240],
  bgGlow: [168, 216, 255],
  cartonWhite: [255, 255, 255],
  cartonShade: [214, 230, 252],
  stripe: [188, 214, 252],
  straw: [255, 159, 67],
  strawDark: [247, 123, 61],
  spark: [255, 255, 255]
}

function drawIcon(S) {
  return renderPixels(S, 512, (X, Y, put) => {
    // 圆角图标外框遮罩
    const mask = alpha(sdRoundRect(X, Y, 20, 20, 492, 492, 116))
    if (mask <= 0.003) return
    // 背景渐变 + 中心高光
    const t = clamp01((Y - 20) / 472)
    let bg = [
      lerp(C.bgTop[0], C.bgBottom[0], t),
      lerp(C.bgTop[1], C.bgBottom[1], t),
      lerp(C.bgTop[2], C.bgBottom[2], t)
    ]
    const glow = alpha(sdCircle(X, Y, 170, 170, 330)) * 0.35
    bg = [
      lerp(bg[0], C.bgGlow[0], glow),
      lerp(bg[1], C.bgGlow[1], glow),
      lerp(bg[2], C.bgGlow[2], glow)
    ]
    put(bg, mask)
    // 牛奶盒主体（白色圆角矩形，带浅蓝渐变）
    const body = alpha(sdRoundRect(X, Y, 168, 168, 344, 356, 26))
    if (body > 0.003) {
      const bt = clamp01((Y - 168) / 188)
      put(
        [
          lerp(C.cartonWhite[0], C.cartonShade[0], bt),
          lerp(C.cartonWhite[1], C.cartonShade[1], bt),
          lerp(C.cartonWhite[2], C.cartonShade[2], bt)
        ],
        body * mask
      )
    }
    // 屋顶（三角形）
    put(C.cartonWhite, alpha(sdTriangle(X, Y, 256, 84, 168, 168, 344, 168)) * mask)
    // 装饰条纹
    put(C.stripe, alpha(sdRoundRect(X, Y, 168, 222, 344, 240, 8)) * mask)
    put(C.stripe, alpha(sdRoundRect(X, Y, 168, 252, 344, 270, 8)) * mask)
    // 吸管
    put(C.straw, alpha(sdRoundRect(X, Y, 302, 46, 330, 190, 12)) * mask)
    put(C.strawDark, alpha(sdRoundRect(X, Y, 296, 30, 336, 60, 12)) * mask)
    // 点缀星光
    put(C.spark, alpha(sdCircle(X, Y, 108, 120, 10)) * 0.8 * mask)
    put(C.spark, alpha(sdCircle(X, Y, 410, 156, 7)) * 0.7 * mask)
    put(C.spark, alpha(sdCircle(X, Y, 402, 380, 9)) * 0.7 * mask)
  })
}

// ---------- 界面内使用的牛奶 Logo（透明背景，设计坐标系 256） ----------
const LOGO_SIZE = 256
const LOGO = {
  line: [86, 132, 214],
  carton: [255, 255, 255],
  shade: [222, 235, 253],
  stripe: [178, 208, 250],
  straw: [255, 159, 67],
  strawDark: [243, 116, 51],
  spark: [255, 255, 255]
}

const G = {
  roof: [128, 49, 64.5, 110, 191.9, 110],
  body: [64.5, 110, 191.9, 246, 19],
  straw: [161.5, 21.6, 181.8, 125.8, 9],
  strawCap: [157.2, 10, 186.1, 31.7, 9]
}
const STROKE = 3.5

function drawMilkLogo(S) {
  return renderPixels(S, LOGO_SIZE, (X, Y, put) => {
    const dRoof = sdTriangle(X, Y, G.roof[0], G.roof[1], G.roof[2], G.roof[3], G.roof[4], G.roof[5])
    const dBody = sdRoundRect(X, Y, G.body[0], G.body[1], G.body[2], G.body[3], G.body[4])
    const dStraw = sdRoundRect(X, Y, G.straw[0], G.straw[1], G.straw[2], G.straw[3], G.straw[4])
    const dStrawCap = sdRoundRect(X, Y, G.strawCap[0], G.strawCap[1], G.strawCap[2], G.strawCap[3], G.strawCap[4])
    // 1. 描边层（比实体外扩 STROKE，保证浅色背景下也有轮廓）
    put(LOGO.line, alpha(dStrawCap - STROKE))
    put(LOGO.line, alpha(dStraw - STROKE))
    put(LOGO.line, alpha(dRoof - STROKE))
    put(LOGO.line, alpha(dBody - STROKE))
    // 2. 屋顶与盒身
    put(LOGO.carton, alpha(dRoof))
    const body = alpha(dBody)
    if (body > 0.003) {
      const t = clamp01((Y - G.body[1]) / (G.body[3] - G.body[1]))
      put(
        [
          lerp(LOGO.carton[0], LOGO.shade[0], t),
          lerp(LOGO.carton[1], LOGO.shade[1], t),
          lerp(LOGO.carton[2], LOGO.shade[2], t)
        ],
        body
      )
    }
    // 3. 盒身装饰条纹
    put(LOGO.stripe, alpha(sdRoundRect(X, Y, 64.5, 149, 191.9, 162, 6)))
    put(LOGO.stripe, alpha(sdRoundRect(X, Y, 64.5, 171, 191.9, 184, 6)))
    // 4. 吸管
    put(LOGO.straw, alpha(dStraw))
    put(LOGO.strawDark, alpha(dStrawCap))
    // 5. 点缀星光
    put(LOGO.spark, alpha(sdCircle(X, Y, 26, 74, 8)) * 0.85)
    put(LOGO.spark, alpha(sdCircle(X, Y, 232, 96, 5)) * 0.7)
  })
}

// 生成 512 与 256 PNG
writeFileSync(join(root, 'build', 'icon.png'), encodePng(512, drawIcon(512)))
writeFileSync(join(root, 'build', 'icon-256.png'), encodePng(256, drawIcon(256)))

// 界面 Logo 与窗口图标共用同一份本地 PNG
const logoDir = join(root, 'src', 'renderer', 'src', 'assets')
mkdirSync(logoDir, { recursive: true })
const milkLogo = encodePng(LOGO_SIZE, drawMilkLogo(LOGO_SIZE))
writeFileSync(join(logoDir, 'milk-logo.png'), milkLogo)
writeFileSync(join(root, 'build', 'milk-logo.png'), milkLogo)

// 生成 ICO（内嵌 256 PNG）
function encodeIco(pngBuf) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0 // 256
  entry[1] = 0 // 256
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(pngBuf.length, 8)
  entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, pngBuf])
}
writeFileSync(join(root, 'build', 'icon.ico'), encodeIco(encodePng(256, drawIcon(256))))
console.log('图标生成完成：build/icon.png, build/icon-256.png, build/icon.ico, build/milk-logo.png, src/renderer/src/assets/milk-logo.png')
