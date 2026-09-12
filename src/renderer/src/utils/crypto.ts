// ===== 密码哈希工具（Web Crypto API） =====
import type { HashAlgo, PasswordHash } from '../types'

export type { HashAlgo }

const enc = new TextEncoder()

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSalt(length = 16): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 使用指定算法对「盐 + 密码」计算哈希 */
export async function hashPassword(password: string, algo: HashAlgo, salt: string): Promise<string> {
  const data = enc.encode(`${salt}::${password}`)
  const digest = await crypto.subtle.digest(algo, data)
  return bytesToHex(digest)
}

/** 生成带盐的密码哈希 */
export async function createPasswordHash(password: string, algo: HashAlgo = 'SHA-256'): Promise<PasswordHash> {
  const salt = randomSalt()
  return { algo, salt, hash: await hashPassword(password, algo, salt) }
}

/** 校验密码是否匹配存储的哈希 */
export async function verifyPassword(password: string, ph: PasswordHash): Promise<boolean> {
  try {
    const h = await hashPassword(password, ph.algo, ph.salt)
    return h === ph.hash
  } catch {
    return false
  }
}

/** 同步校验：兼容极少数无法使用 Web Crypto 的场景（降低安全性，仅作兜底） */
export function fallbackHash(password: string): string {
  // 轻量非加密哈希，仅在 Web Crypto 不可用时兜底
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  const s = `${password}::milk-class-points`
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
