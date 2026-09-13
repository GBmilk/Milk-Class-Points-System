import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'

// pwd 管理员密码文件：固定放在「软件运行目录」，与程序放在一起
let cachedPath: string | null = null

/**
 * 软件运行目录：
 * - 打包运行：可执行文件（exe）所在目录，即程序实际运行目录；
 * - 开发运行：项目根目录（package.json 所在目录，app.getAppPath()）。
 * 不使用 AppData / 临时目录，保证 pwd 文件始终跟程序在一起。
 */
function runDir(): string {
  return app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
}

/** 备用目录：仅当运行目录不可写（如安装到 Program Files 且无权限）时使用，避免功能不可用 */
function fallbackDir(): string {
  return app.getPath('userData')
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** 目录是否可写（写入探针文件后立即删除，不会残留） */
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
  /** 是否为软件运行目录（界面可用它说明文件位置） */
  inRunDir: boolean
}

/**
 * 定位 pwd 文件：
 * 1. 运行目录下的 pwd 优先；
 * 2. 兼容旧版本遗留在应用数据目录中的 pwd（保证原有管理员密码继续可用）；
 * 3. 两处都没有时，默认选择运行目录（不可写才退回应用数据目录）。
 * 只做定位与只读检查，不会覆盖或重置已有密码。
 */
export async function resolvePwdPath(): Promise<PwdFileStatus> {
  const primary = runDir()
  const fallback = fallbackDir()
  let dir = ''

  if (cachedPath) {
    const cachedDir = dirname(cachedPath)
    if (cachedDir === primary || cachedDir === fallback) dir = cachedDir
  }
  if (!dir) {
    if (await fileExists(join(primary, 'pwd'))) dir = primary
    else if (await fileExists(join(fallback, 'pwd'))) dir = fallback
  }
  if (!dir) {
    dir = (await dirWritable(primary)) ? primary : fallback
  }

  const p = join(dir, 'pwd')
  const status: PwdFileStatus = {
    path: p,
    dir,
    exists: await fileExists(p),
    writable: await dirWritable(dir),
    inRunDir: dir === primary
  }
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

/** 生成 / 更新 pwd 文件：优先写入软件运行目录，运行目录不可写时才退回应用数据目录 */
export async function createPwdFile(password: string): Promise<{ ok: boolean; path: string; error?: string }> {
  const primary = runDir()
  const primaryWritable = await dirWritable(primary)
  const dir = primaryWritable ? primary : fallbackDir()
  const target = join(dir, 'pwd')
  if (!primaryWritable && !(await dirWritable(dir))) {
    return { ok: false, path: target, error: `运行目录没有写入权限：${primary}` }
  }
  try {
    await fs.writeFile(target, password.trim(), 'utf-8')
    cachedPath = target
    return { ok: true, path: target }
  } catch (e) {
    return { ok: false, path: target, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 首次运行时写入 pwd 文件的默认管理员密码（仅在初始化时使用，不在界面中展示） */
export const DEFAULT_ADMIN_PASSWORD = 'admin123456'

/**
 * 启动时确保「软件运行目录」内存在 pwd 文件：
 * - 运行目录已有 pwd：直接沿用，不覆盖、不重置；
 * - 运行目录可写但还没有 pwd：优先沿用旧版本遗留在应用数据目录的管理员密码，其次写入默认管理员密码；
 * - 运行目录不可写（例如装在 Program Files 且无权限）：保持回退到应用数据目录，不阻塞启动。
 */
export async function ensurePwdFile(): Promise<PwdFileStatus> {
  const runPwd = join(runDir(), 'pwd')
  const legacyPwd = join(fallbackDir(), 'pwd')
  try {
    if (!(await fileExists(runPwd))) {
      if (!(await fileExists(legacyPwd))) {
        // 全新安装：生成默认管理员密码文件
        await createPwdFile(DEFAULT_ADMIN_PASSWORD)
      } else {
        // 旧版本遗留在应用数据目录：迁移到运行目录，保持原管理员密码不变
        const legacy = (await fs.readFile(legacyPwd, 'utf-8')).replace(/^\uFEFF/, '').trim()
        if (legacy) await createPwdFile(legacy)
      }
    }
  } catch (e) {
    // 写入失败不能导致程序崩溃：读取逻辑会自动回退到应用数据目录
    console.error('初始化 pwd 文件失败：', e)
  }
  cachedPath = null
  return resolvePwdPath()
}

export function resetPwdCache(): void {
  cachedPath = null
}
