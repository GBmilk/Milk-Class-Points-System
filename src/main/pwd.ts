import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

// pwd 管理员密码文件：位于可执行文件所在目录，无写入权限时回退到应用数据目录
let cachedPath: string | null = null

function exeDir(): string {
  return join(app.getPath('exe'), '..')
}

async function dirWritable(dir: string): Promise<boolean> {
  try {
    const probe = join(dir, `.pwd-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.writeFile(probe, 'probe', 'utf-8')
    await fs.unlink(probe)
    return true
  } catch {
    return false
  }
}

export interface PwdFileStatus {
  path: string
  dir: string
  exists: boolean
  writable: boolean
}

export async function resolvePwdPath(): Promise<PwdFileStatus> {
  const userData = app.getPath('userData')
  const candidates = [exeDir(), userData]
  let finalDir = ''

  if (cachedPath) {
    const dir = join(cachedPath, '..')
    if (candidates.includes(dir)) finalDir = dir
  }
  if (!finalDir) {
    // 已有文件优先
    for (const dir of candidates) {
      try {
        await fs.access(join(dir, 'pwd'))
        finalDir = dir
        break
      } catch {
        // 该目录下没有 pwd 文件，继续尝试下一个
      }
    }
  }
  if (!finalDir) {
    // 都不存在：优先选择第一个可写目录
    for (const dir of candidates) {
      if (await dirWritable(dir)) {
        finalDir = dir
        break
      }
    }
  }
  if (!finalDir) finalDir = userData

  const p = join(finalDir, 'pwd')
  let exists = false
  try {
    await fs.access(p)
    exists = true
  } catch {
    exists = false
  }
  const writable = await dirWritable(finalDir)
  const status: PwdFileStatus = { path: p, dir: finalDir, exists, writable }
  cachedPath = p
  return status
}

export async function readPwdContent(): Promise<string | null> {
  const status = await resolvePwdPath()
  if (!status.exists) return null
  try {
    const content = await fs.readFile(status.path, 'utf-8')
    return content.replace(/^\uFEFF/, '').trim()
  } catch {
    return null
  }
}

/** 在内存中校验管理员密码，不把明文返回给渲染进程 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  const content = await readPwdContent()
  if (!content) return false
  return content === input.trim()
}

export async function createPwdFile(password: string): Promise<{ ok: boolean; path: string; error?: string }> {
  const status = await resolvePwdPath()
  if (!status.writable) {
    return { ok: false, path: status.path, error: '目标目录没有写入权限' }
  }
  try {
    await fs.writeFile(status.path, password.trim(), 'utf-8')
    cachedPath = status.path
    return { ok: true, path: status.path }
  } catch (e) {
    return { ok: false, path: status.path, error: e instanceof Error ? e.message : String(e) }
  }
}

export function resetPwdCache(): void {
  cachedPath = null
}
