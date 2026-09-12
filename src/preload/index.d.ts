// preload 暴露给渲染进程的 API 类型声明
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

export interface WriteResult {
  ok: boolean
  error?: string
}

export interface ReadResult {
  ok: boolean
  content?: string
  error?: string
}

declare global {
  interface Window {
    api: {
      pwdStatus(): Promise<PwdStatus>
      pwdVerify(password: string): Promise<boolean>
      pwdCreate(password: string): Promise<{ ok: boolean; path: string; error?: string }>
      saveFile(opts: SaveFileOptions): Promise<string | null>
      openFile(opts: OpenFileOptions): Promise<string | null>
      writeFile(targetPath: string, content: string): Promise<WriteResult>
      readFile(targetPath: string): Promise<ReadResult>
      appInfo(): Promise<AppInfo>
    }
  }
}
