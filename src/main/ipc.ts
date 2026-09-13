import { BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { isAbsolute } from 'node:path'
import { resolvePwdPath, verifyAdminPassword } from './pwd'
import { APP_VERSION } from '../shared/app-version'

interface SaveFileOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

interface OpenFileOptions {
  title?: string
  filters?: { name: string; extensions: string[] }[]
}

/** IPC 入参基本校验，防止非法数据进入主进程 */
function validPassword(pwd: unknown): pwd is string {
  return typeof pwd === 'string' && pwd.length >= 1 && pwd.length <= 128
}

function validPath(p: unknown): p is string {
  return typeof p === 'string' && p.length > 0 && p.length <= 4096 && isAbsolute(p)
}

export function registerIpc(): void {
  // ---- 管理员密码文件 ----
  ipcMain.handle('pwd:status', async () => {
    const s = await resolvePwdPath()
    return { exists: s.exists, path: s.path, dir: s.dir, writable: s.writable, inRunDir: s.inRunDir }
  })

  ipcMain.handle('pwd:verify', async (_e, pwd: unknown) => {
    if (!validPassword(pwd)) return false
    return verifyAdminPassword(pwd)
  })

  // ---- 原生对话框 ----
  ipcMain.handle('dialog:save-file', async (e, opts: SaveFileOptions | undefined) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showSaveDialog(win!, {
      title: opts?.title ?? '保存文件',
      defaultPath: opts?.defaultPath,
      filters: opts?.filters
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('dialog:open-file', async (e, opts: OpenFileOptions | undefined) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: opts?.title ?? '选择文件',
      filters: opts?.filters,
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ---- 文件读写（导出/导入使用） ----
  ipcMain.handle('file:write', async (_e, payload: { path?: unknown; content?: unknown }) => {
    if (!payload || typeof payload !== 'object') return { ok: false, error: '参数无效' }
    const targetPath = payload.path
    const content = payload.content
    if (!validPath(targetPath)) return { ok: false, error: '文件路径无效' }
    if (typeof content !== 'string' || content.length > 100 * 1024 * 1024) {
      return { ok: false, error: '文件内容无效或过大' }
    }
    try {
      await fs.writeFile(targetPath, content, 'utf-8')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('file:read', async (_e, targetPath: unknown) => {
    if (!validPath(targetPath)) return { ok: false, error: '文件路径无效' }
    try {
      const stat = await fs.stat(targetPath)
      if (!stat.isFile() || stat.size > 100 * 1024 * 1024) {
        return { ok: false, error: '文件过大或不是普通文件' }
      }
      const content = await fs.readFile(targetPath, 'utf-8')
      return { ok: true, content }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // ---- 应用信息 ----
  ipcMain.handle('app:info', async () => {
    return {
      name: '牛奶智慧班级积分',
      version: APP_VERSION,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform
    }
  })
}
