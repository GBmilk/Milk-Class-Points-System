import { contextBridge, ipcRenderer } from 'electron'

export interface PwdStatus {
  exists: boolean
  path: string
  dir: string
  writable: boolean
}

export interface SaveFileOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}

export interface OpenFileOptions {
  title?: string
  filters?: { name: string; extensions: string[] }[]
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
}

const api = {
  // 管理员密码文件
  pwdStatus: (): Promise<PwdStatus> => ipcRenderer.invoke('pwd:status'),
  pwdVerify: (password: string): Promise<boolean> => ipcRenderer.invoke('pwd:verify', password),
  pwdCreate: (password: string): Promise<{ ok: boolean; path: string; error?: string }> =>
    ipcRenderer.invoke('pwd:create', password),
  // 原生对话框与文件读写
  saveFile: (opts: SaveFileOptions): Promise<string | null> => ipcRenderer.invoke('dialog:save-file', opts),
  openFile: (opts: OpenFileOptions): Promise<string | null> => ipcRenderer.invoke('dialog:open-file', opts),
  writeFile: (targetPath: string, content: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('file:write', { path: targetPath, content }),
  readFile: (targetPath: string): Promise<{ ok: boolean; content?: string; error?: string }> =>
    ipcRenderer.invoke('file:read', targetPath),
  // 应用信息
  appInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
