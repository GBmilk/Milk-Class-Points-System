import { app, BrowserWindow, shell, Menu } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null

/** 解析本地 PNG 图标路径：开发环境取 build/icon.png，打包后取 resources/icon.png */
function resolveIconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'icon.png')]
    : [join(__dirname, '../../build/icon.png')]
  return candidates.find((p) => existsSync(p))
}

function createWindow(): void {
  // 图标路径不存在时不阻塞开发环境启动
  const iconPath = resolveIconPath()
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: '牛奶智慧班级积分',
    backgroundColor: '#eef3fb',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 窗口被遮挡或最小化时不做节流：避免动画卡住、并保证防抖保存能及时落盘
      backgroundThrottling: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 禁止新开不受信任的窗口，外部链接交给系统浏览器
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 单实例锁，避免重复打开
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpc()
    // 打包后隐藏默认菜单；开发模式保留以便使用开发者工具
    if (app.isPackaged) Menu.setApplicationMenu(null)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
