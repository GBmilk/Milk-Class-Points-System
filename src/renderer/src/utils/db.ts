// ===== IndexedDB 持久化封装（带 localStorage 兜底） =====
const DB_NAME = 'milk-class-points-db'
const STORE_NAME = 'kv'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

/** 存储是否可用（隐私模式下 IndexedDB 可能不可用） */
let idbAvailable = true

export async function dbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return
  } catch (e) {
    // 降级到 localStorage，保证数据不丢失
    idbAvailable = false
    try {
      localStorage.setItem(`db:${key}`, JSON.stringify(value))
    } catch (e2) {
      console.error('数据保存失败', e2)
      throw e2
    }
  }
}

export async function dbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb()
    const result = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
    if (result !== undefined) return result
    // IndexedDB 中没有时，检查 localStorage 兜底数据
    const raw = localStorage.getItem(`db:${key}`)
    if (raw) return JSON.parse(raw) as T
    return null
  } catch (e) {
    console.error('数据读取失败，尝试 localStorage', e)
    idbAvailable = false
    try {
      const raw = localStorage.getItem(`db:${key}`)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }
}

export async function dbDelete(key: string): Promise<void> {
  try {
    const db = await getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // 忽略兜底
  }
  try {
    localStorage.removeItem(`db:${key}`)
  } catch {
    // 忽略
  }
}

export async function dbClear(): Promise<void> {
  try {
    const db = await getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // 忽略
  }
  try {
    localStorage.clear()
  } catch {
    // 忽略
  }
}

export function isIdbAvailable(): boolean {
  return idbAvailable
}
