<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Brush,
  School,
  Lock,
  Coin,
  DataAnalysis,
  Document,
  InfoFilled
} from '@element-plus/icons-vue'
import { THEMES } from '../themes'
import { useDataStore } from '../stores/data'
import { useAuthStore } from '../stores/auth'
import { createPasswordHash } from '../utils/crypto'
import { DEFAULT_PASSWORD } from '../utils/defaults'
import { compressImageFile, readFileAsDataURL, BACKGROUND_IMG_SIZE } from '../utils/image'
import { formatDateTime } from '../utils/date'
import { resolveAppLogo } from '../utils/logo'
import type { DataState, HashAlgo, SystemSettings } from '../types'

const router = useRouter()
const data = useDataStore()
const auth = useAuthStore()
const s = () => data.state
const activeTab = ref('appearance')

// ===== 外观设置 =====
const themeId = computed({
  get: () => s().settings.theme,
  set: (v) => data.updateSettings({ theme: v })
})
const themeMode = computed({
  get: () => s().settings.themeMode,
  set: (v) => data.updateSettings({ themeMode: v })
})
const bgUploading = ref(false)

async function uploadBackground(file: File): Promise<void> {
  try {
    bgUploading.value = true
    const dataUrl = await compressImageFile(file, { maxSize: BACKGROUND_IMG_SIZE, quality: 0.72, maxInputBytes: 15 * 1024 * 1024 })
    data.updateSettings({ backgroundImage: dataUrl })
    ElMessage.success('背景图片已应用')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '背景图片处理失败')
  } finally {
    bgUploading.value = false
  }
}

function onBackgroundUpload(options: { file: File }): Promise<void> {
  return uploadBackground(options.file)
}

function clearBackground(): void {
  ElMessageBox.confirm('确定清除自定义背景图片吗？将恢复为主题渐变背景。', '清除背景', {
    confirmButtonText: '清除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      data.updateSettings({ backgroundImage: null })
      ElMessage.success('已恢复默认背景')
    })
    .catch(() => {})
}

// ===== 软件图标（读取本地 PNG 文件） =====
const appLogoInput = ref<HTMLInputElement | null>(null)
const appLogoUploading = ref(false)
/** 当前生效的软件图标（自定义 PNG > 班级头像 > 内置牛奶图标） */
const appLogo = computed(() => resolveAppLogo(s().settings))

function pickAppLogo(): void {
  appLogoInput.value?.click()
}

async function uploadAppLogo(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.type !== 'image/png') {
    ElMessage.warning('请选择 PNG 格式的图片')
    return
  }
  if (file.size > 512 * 1024) {
    ElMessage.warning('图标文件请小于 512KB')
    return
  }
  try {
    appLogoUploading.value = true
    // 直接读取原始 PNG，保留透明通道，不做有损压缩
    const dataUrl = await readFileAsDataURL(file)
    data.updateSettings({ appLogo: dataUrl })
    ElMessage.success('软件图标已更新')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '图标读取失败')
  } finally {
    appLogoUploading.value = false
  }
}

function resetAppLogo(): void {
  ElMessageBox.confirm('确定恢复为内置的牛奶图标吗？', '恢复默认图标', {
    confirmButtonText: '恢复',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      data.updateSettings({ appLogo: null })
      ElMessage.success('已恢复内置牛奶图标')
    })
    .catch(() => {})
}

// ===== 班级设置 =====
const classForm = reactive({ className: '', classSlogan: '', classIntro: '', teacherName: '' })
watch(
  () => [s().settings.className, s().settings.classSlogan, s().settings.classIntro, s().settings.teacherName] as const,
  ([cn, cs, ci, tn]) => {
    classForm.className = cn
    classForm.classSlogan = cs
    classForm.classIntro = ci
    classForm.teacherName = tn
  },
  { immediate: true }
)
function saveClassInfo(): void {
  if (!classForm.className.trim()) {
    ElMessage.warning('班级名称不能为空')
    return
  }
  data.updateSettings({
    className: classForm.className.trim(),
    classSlogan: classForm.classSlogan.trim(),
    classIntro: classForm.classIntro.trim(),
    teacherName: classForm.teacherName.trim()
  })
  ElMessage.success('班级信息已保存')
}

// ===== 班级头像（读取本地文件） =====
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarUploading = ref(false)

function pickAvatar(): void {
  avatarInput.value?.click()
}

async function uploadClassAvatar(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    avatarUploading.value = true
    const dataUrl = await compressImageFile(file, { maxSize: 256, quality: 0.85 })
    data.updateSettings({ classAvatar: dataUrl })
    ElMessage.success('班级头像已更新，主界面同步生效')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '头像上传失败')
  } finally {
    avatarUploading.value = false
  }
}

function clearClassAvatar(): void {
  ElMessageBox.confirm('确定清除班级头像吗？清除后将恢复默认图标。', '清除确认', { type: 'warning' })
    .then(() => {
      data.updateSettings({ classAvatar: null })
      ElMessage.success('已清除班级头像')
    })
    .catch(() => {})
}

// ===== 密码设置 =====
const pwdForm = reactive({ oldPwd: '', newPwd: '', confirmPwd: '' })
const pwdAlgo = ref<HashAlgo>('SHA-256')
const pwdChanging = ref(false)
const currentAlgo = computed(() => s().settings.passwordHash?.algo ?? '未设置（首次运行自动初始化）')

async function changePassword(): Promise<void> {
  if (pwdChanging.value) return
  if (!pwdForm.oldPwd) {
    ElMessage.warning('请输入旧密码')
    return
  }
  if (!pwdForm.newPwd || pwdForm.newPwd.length < 6) {
    ElMessage.warning('新密码长度至少 6 位')
    return
  }
  if (pwdForm.newPwd !== pwdForm.confirmPwd) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  pwdChanging.value = true
  try {
    const res = await auth.changePassword(pwdForm.oldPwd, pwdForm.newPwd, pwdAlgo.value)
    if (!res.ok) {
      ElMessage.error(res.message ?? '修改失败')
      return
    }
    ElMessage.success(`密码已更新（哈希算法：${pwdAlgo.value}）`)
    pwdForm.oldPwd = ''
    pwdForm.newPwd = ''
    pwdForm.confirmPwd = ''
  } finally {
    pwdChanging.value = false
  }
}
// ===== 积分设置 =====
const allowNegativeSwitch = computed({
  get: () => s().settings.allowNegative,
  set: (v) => data.updateSettings({ allowNegative: v })
})
const allowNegativePurchaseSwitch = computed({
  get: () => s().settings.allowNegativePurchase,
  set: (v) => data.updateSettings({ allowNegativePurchase: v })
})

const newAddReason = ref('')
const newDeductReason = ref('')
const editState = reactive({ addIdx: -1, addText: '', deductIdx: -1, deductText: '' })

function addReason(kind: 'add' | 'deduct'): void {
  const key = kind === 'add' ? 'addReasons' : 'deductReasons'
  const input = kind === 'add' ? newAddReason : newDeductReason
  const value = input.value.trim()
  if (!value) {
    ElMessage.warning('请输入原因内容')
    return
  }
  if (s().settings[key].includes(value)) {
    ElMessage.warning('该原因已存在')
    return
  }
  const patch: Partial<SystemSettings> = {}
  patch[key as 'addReasons' | 'deductReasons'] = [...s().settings[key], value]
  data.updateSettings(patch)
  input.value = ''
  ElMessage.success('已添加')
}

function removeReason(kind: 'add' | 'deduct', idx: number): void {
  const key = kind === 'add' ? 'addReasons' : 'deductReasons'
  const item = s().settings[key][idx]
  ElMessageBox.confirm(`确定删除原因「${item}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      const list = [...s().settings[key]]
      list.splice(idx, 1)
      const patch: Partial<SystemSettings> = {}
      patch[key as 'addReasons' | 'deductReasons'] = list
      data.updateSettings(patch)
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

function startEdit(kind: 'add' | 'deduct', idx: number): void {
  const key = kind === 'add' ? 'addReasons' : 'deductReasons'
  if (kind === 'add') {
    editState.addIdx = idx
    editState.addText = s().settings.addReasons[idx]
  } else {
    editState.deductIdx = idx
    editState.deductText = s().settings.deductReasons[idx]
  }
}

function saveEdit(kind: 'add' | 'deduct'): void {
  const key = kind === 'add' ? 'addReasons' : 'deductReasons'
  const idx = kind === 'add' ? editState.addIdx : editState.deductIdx
  const text = kind === 'add' ? editState.addText : editState.deductText
  if (idx < 0) return
  const value = text.trim()
  if (!value) {
    ElMessage.warning('原因内容不能为空')
    return
  }
  const list = [...s().settings[key]]
  list[idx] = value
  const patch: Partial<SystemSettings> = {}
  patch[key as 'addReasons' | 'deductReasons'] = list
  data.updateSettings(patch)
  if (kind === 'add') editState.addIdx = -1
  else editState.deductIdx = -1
  ElMessage.success('已更新')
}

// ===== 数据管理 =====
async function exportAll(): Promise<void> {
  const snapshot = data.exportSnapshot()
  const payload = {
    app: 'milk-class-points',
    dataVersion: snapshot.version,
    exportedAt: new Date().toISOString(),
    data: snapshot
  }
  try {
    const path = await window.api.saveFile({
      title: '导出班级数据',
      defaultPath: `班级数据备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (!path) return
    const res = await window.api.writeFile(path, JSON.stringify(payload, null, 2))
    if (res.ok) {
      ElMessage.success(`导出成功：${snapshot.students.length} 名学生、${snapshot.records.length} 条记录、${snapshot.products.length} 件商品、${snapshot.groups.length} 个小组、${snapshot.honors.length} 项荣誉`)
    } else {
      ElMessage.error(res.error ?? '导出失败')
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

const importSummary = ref('')

async function importAll(): Promise<void> {
  try {
    const path = await window.api.openFile({
      title: '选择班级数据备份文件',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (!path) return
    const res = await window.api.readFile(path)
    if (!res.ok || !res.content) {
      ElMessage.error(res.error ?? '读取文件失败')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(res.content)
    } catch {
      ElMessage.error('文件不是有效的 JSON 格式')
      return
    }
    const check = data.validateImport(parsed)
    if (!check.ok) {
      ElMessage.error(check.message ?? '数据结构校验失败')
      return
    }
    const d = (parsed as { data: { students: unknown[]; records: unknown[]; products: unknown[]; groups: unknown[]; honors: unknown[] } }).data
    importSummary.value = `学生 ${d.students.length} 名、积分记录 ${d.records.length} 条、商品 ${d.products.length} 件、小组 ${d.groups.length} 个、荣誉 ${d.honors.length} 项`
    await ElMessageBox.confirm(
      `导入将<b>覆盖当前所有数据</b>，当前数据会被替换。\n\n备份内容：${importSummary.value}\n\n确定继续导入吗？`,
      '导入确认',
      {
        confirmButtonText: '覆盖导入',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true
      }
    )
    data.importSnapshot((parsed as { data: DataState }).data)
    ElMessage.success('数据导入成功')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof Error ? e.message : '导入失败')
  }
}

function resetBusiness(): void {
  ElMessageBox.confirm('将清空所有学生、积分记录、商品、小组和荣誉数据（保留系统设置与密码），确定继续吗？', '重置业务数据', {
    confirmButtonText: '继续',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() =>
      ElMessageBox.confirm('再次确认：重置后所有业务数据将丢失，且无法恢复。', '二次确认', {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        type: 'error'
      })
    )
    .then(() => {
      data.resetBusinessData()
      ElMessage.success('业务数据已重置')
    })
    .catch(() => {})
}

function clearAll(): void {
  ElMessageBox.confirm('将清空<u>所有数据</u>（含设置与密码，恢复首次运行状态），确定继续吗？', '清空所有数据', {
    confirmButtonText: '继续',
    cancelButtonText: '取消',
    type: 'error',
    dangerouslyUseHTMLString: true
  })
    .then(() =>
      ElMessageBox.confirm('再次确认：清空后将恢复初始状态（默认密码也将恢复），无法恢复任何数据！', '最终确认', {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        type: 'error'
      })
    )
    .then(async () => {
      data.clearAllData()
      // 恢复首次运行的默认密码
      const hash = await createPasswordHash(DEFAULT_PASSWORD, 'SHA-256')
      data.setPasswordHash(hash)
      auth.logout()
      ElMessage.success('所有数据已清空，程序恢复初始状态')
      router.push('/login')
    })
    .catch(() => {})
}
// ===== 管理员密码文件 =====
const pwdStatus = ref<{ exists: boolean; path: string; dir: string; writable: boolean } | null>(null)
const pwdCreateVisible = ref(false)
const pwdCreateForm = reactive({ password: '', confirm: '' })
const pwdCreating = ref(false)

async function refreshPwdStatus(): Promise<void> {
  try {
    pwdStatus.value = await window.api.pwdStatus()
  } catch (e) {
    pwdStatus.value = null
    ElMessage.error('无法获取管理员密码文件状态')
  }
}

async function createPwdFile(): Promise<void> {
  if (pwdCreating.value) return
  if (!pwdCreateForm.password || pwdCreateForm.password.length < 1) {
    ElMessage.warning('请输入管理员密码')
    return
  }
  if (pwdCreateForm.password !== pwdCreateForm.confirm) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  pwdCreating.value = true
  try {
    const res = await window.api.pwdCreate(pwdCreateForm.password)
    if (res.ok) {
      ElMessage.success(`管理员密码文件已创建：${res.path}`)
      pwdCreateVisible.value = false
      pwdCreateForm.password = ''
      pwdCreateForm.confirm = ''
      await refreshPwdStatus()
    } else {
      ElMessage.error(res.error ?? '创建失败，请检查目录权限')
    }
  } finally {
    pwdCreating.value = false
  }
}

// ===== 关于 =====
const appInfo = ref<{ version: string } | null>(null)

onMounted(async () => {
  await refreshPwdStatus()
  try {
    appInfo.value = await window.api.appInfo()
  } catch {
    appInfo.value = { version: '1.0.1B23' }
  }
})
</script>
<template>
  <div class="page">
    <el-tabs v-model="activeTab" tab-position="left" class="settings-tabs">
      <!-- 外观设置 -->
      <el-tab-pane label="外观设置" name="appearance">
        <div class="settings-content">
          <div class="glass-card setting-card">
            <div class="setting-title">主题颜色（14 套，切换立即生效）</div>
            <div class="theme-grid">
              <div
                v-for="t in THEMES"
                :key="t.id"
                class="theme-item"
                :class="{ active: themeId === t.id }"
                @click="themeId = t.id"
              >
                <div class="theme-swatch" :style="{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }">
                  <el-icon v-if="themeId === t.id" :size="16" color="#fff"><InfoFilled /></el-icon>
                </div>
                <div class="theme-name" :class="{ active: themeId === t.id }">{{ t.name }}</div>
              </div>
            </div>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title">深浅模式</div>
            <el-radio-group v-model="themeMode">
              <el-radio-button value="light">浅色模式</el-radio-button>
              <el-radio-button value="dark">深色模式</el-radio-button>
              <el-radio-button value="system">跟随系统</el-radio-button>
            </el-radio-group>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title">自定义背景图片</div>
            <div class="flex gap12 flex-wrap">
              <el-upload :show-file-list="false" accept="image/*" :http-request="onBackgroundUpload">
                <el-button :loading="bgUploading">上传背景图片</el-button>
              </el-upload>
              <el-button v-if="s().settings.backgroundImage" type="danger" plain @click="clearBackground">清除背景图片</el-button>
              <span class="text-secondary" style="font-size: 12px">支持 jpg / png，自动压缩，重启后保留</span>
            </div>
            <div v-if="s().settings.backgroundImage" class="bg-preview mt12">
              <img :src="s().settings.backgroundImage ?? undefined" alt="" />
            </div>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title">软件图标（读取本地 PNG 文件）</div>
            <div class="flex gap12 flex-wrap items-center">
              <div class="app-logo-preview">
                <img :src="appLogo" alt="软件图标" />
              </div>
              <input ref="appLogoInput" type="file" accept="image/png" class="hidden-input" @change="uploadAppLogo" />
              <el-button size="small" :loading="appLogoUploading" @click="pickAppLogo">选择本地 PNG</el-button>
              <el-button v-if="s().settings.appLogo" size="small" type="danger" plain @click="resetAppLogo">恢复内置图标</el-button>
              <span class="text-secondary" style="font-size: 12px">
                用于侧边栏与登录页；建议使用正方形透明 PNG（小于 512KB），重启后保留
              </span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 班级设置 -->
      <el-tab-pane label="班级设置" name="class">
        <div class="settings-content">
          <div class="glass-card setting-card">
            <div class="setting-title">班级信息</div>
            <el-form label-width="90px" style="max-width: 620px">
              <el-form-item label="班级头像">
                <div class="flex gap8 items-center">
                  <div class="avatar-preview">
                    <img v-if="s().settings.classAvatar" :src="s().settings.classAvatar ?? undefined" alt="" />
                    <span v-else>🏫</span>
                  </div>
                  <input ref="avatarInput" type="file" accept="image/*" class="hidden-input" @change="uploadClassAvatar" />
                  <el-button size="small" :loading="avatarUploading" @click="pickAvatar">从本地文件选择</el-button>
                  <el-button v-if="s().settings.classAvatar" size="small" type="danger" plain @click="clearClassAvatar">清除</el-button>
                  <span class="text-secondary" style="font-size: 12px">头像将从本地图片文件读取并持久化</span>
                </div>
              </el-form-item>
              <el-form-item label="班级名称" required>
                <el-input v-model="classForm.className" maxlength="30" />
              </el-form-item>
              <el-form-item label="班主任">
                <el-input v-model="classForm.teacherName" placeholder="可选" maxlength="20" />
              </el-form-item>
              <el-form-item label="班级口号">
                <el-input v-model="classForm.classSlogan" maxlength="40" />
              </el-form-item>
              <el-form-item label="班级简介">
                <el-input v-model="classForm.classIntro" type="textarea" :rows="3" maxlength="100" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveClassInfo">保存班级信息</el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-tab-pane>

      <!-- 密码设置 -->
      <el-tab-pane label="密码设置" name="password">
        <div class="settings-content">
          <div class="glass-card setting-card">
            <div class="setting-title">修改普通登录密码</div>
            <el-alert
              :title="`当前存储算法：${currentAlgo}（密码以「盐 + 哈希」形式保存，不保存明文）`"
              type="info"
              :closable="false"
              class="mb12"
            />
            <el-form label-width="100px" style="max-width: 460px">
              <el-form-item label="旧密码" required>
                <el-input v-model="pwdForm.oldPwd" type="password" show-password placeholder="请输入旧密码" />
              </el-form-item>
              <el-form-item label="新密码" required>
                <el-input v-model="pwdForm.newPwd" type="password" show-password placeholder="至少 6 位" />
              </el-form-item>
              <el-form-item label="确认新密码" required>
                <el-input v-model="pwdForm.confirmPwd" type="password" show-password placeholder="再次输入新密码" />
              </el-form-item>
              <el-form-item label="哈希算法">
                <el-select v-model="pwdAlgo" style="width: 220px">
                  <el-option label="SHA-256（推荐）" value="SHA-256" />
                  <el-option label="SHA-512（更安全）" value="SHA-512" />
                  <el-option label="SHA-1（不推荐，兼容旧设备）" value="SHA-1" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="pwdChanging" @click="changePassword">修改密码</el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-tab-pane>
      <!-- 积分设置 -->
      <el-tab-pane label="积分设置" name="points">
        <div class="settings-content">
          <div class="glass-card setting-card">
            <div class="setting-title">积分规则</div>
            <div class="switch-row">
              <div>
                <div class="switch-label">允许积分为负数</div>
                <div class="text-secondary" style="font-size: 12px">关闭时减分不能超过当前积分，批量减分整体校验</div>
              </div>
              <el-switch v-model="allowNegativeSwitch" />
            </div>
            <div class="switch-row">
              <div>
                <div class="switch-label">允许购买后积分为负数</div>
                <div class="text-secondary" style="font-size: 12px">关闭时积分不足不能购买（默认关闭）</div>
              </div>
              <el-switch v-model="allowNegativePurchaseSwitch" />
            </div>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title flex-between">
              <span>默认加分原因（{{ s().settings.addReasons.length }} 条）</span>
              <div class="flex gap8">
                <el-input v-model="newAddReason" placeholder="新增加分原因" maxlength="30" style="width: 180px" @keyup.enter="addReason('add')" />
                <el-button type="primary" size="small" @click="addReason('add')">添加</el-button>
              </div>
            </div>
            <div class="reason-list">
              <div v-for="(r, idx) in s().settings.addReasons" :key="`a-${idx}`" class="reason-row">
                <template v-if="editState.addIdx === idx">
                  <el-input v-model="editState.addText" size="small" maxlength="30" style="width: 240px" @keyup.enter="saveEdit('add')" />
                  <el-button type="primary" size="small" @click="saveEdit('add')">保存</el-button>
                  <el-button size="small" @click="editState.addIdx = -1">取消</el-button>
                </template>
                <template v-else>
                  <span class="reason-index">{{ idx + 1 }}</span>
                  <span class="reason-text">{{ r }}</span>
                  <el-button text size="small" @click="startEdit('add', idx)">编辑</el-button>
                  <el-button text size="small" type="danger" @click="removeReason('add', idx)">删除</el-button>
                </template>
              </div>
            </div>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title flex-between">
              <span>默认减分原因（{{ s().settings.deductReasons.length }} 条）</span>
              <div class="flex gap8">
                <el-input v-model="newDeductReason" placeholder="新增减分原因" maxlength="30" style="width: 180px" @keyup.enter="addReason('deduct')" />
                <el-button type="primary" size="small" @click="addReason('deduct')">添加</el-button>
              </div>
            </div>
            <div class="reason-list">
              <div v-for="(r, idx) in s().settings.deductReasons" :key="`d-${idx}`" class="reason-row">
                <template v-if="editState.deductIdx === idx">
                  <el-input v-model="editState.deductText" size="small" maxlength="30" style="width: 240px" @keyup.enter="saveEdit('deduct')" />
                  <el-button type="primary" size="small" @click="saveEdit('deduct')">保存</el-button>
                  <el-button size="small" @click="editState.deductIdx = -1">取消</el-button>
                </template>
                <template v-else>
                  <span class="reason-index">{{ idx + 1 }}</span>
                  <span class="reason-text">{{ r }}</span>
                  <el-button text size="small" @click="startEdit('deduct', idx)">编辑</el-button>
                  <el-button text size="small" type="danger" @click="removeReason('deduct', idx)">删除</el-button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 数据管理 -->
      <el-tab-pane label="数据管理" name="data">
        <div class="settings-content">
          <div class="glass-card setting-card">
            <div class="setting-title">导出 / 导入班级数据</div>
            <div class="flex gap12 flex-wrap">
              <el-button type="primary" :icon="Document" @click="exportAll">导出全部数据（JSON）</el-button>
              <el-button type="success" @click="importAll">导入数据（JSON）</el-button>
            </div>
            <div class="text-secondary mt12" style="font-size: 12px">
              导出文件包含：系统设置、学生、积分记录、商品、小组、荣誉。导入采用覆盖模式，导入前会校验格式并显示摘要。
            </div>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title" style="color: var(--el-color-warning)">危险操作</div>
            <div class="switch-row">
              <div>
                <div class="switch-label">重置业务数据</div>
                <div class="text-secondary" style="font-size: 12px">清空学生 / 记录 / 商品 / 小组 / 荣誉，保留设置与密码</div>
              </div>
              <el-button type="warning" plain @click="resetBusiness">重置业务数据</el-button>
            </div>
            <div class="switch-row">
              <div>
                <div class="switch-label">清空所有数据</div>
                <div class="text-secondary" style="font-size: 12px">恢复首次运行状态（默认密码也会恢复），需要二次确认</div>
              </div>
              <el-button type="danger" plain @click="clearAll">清空所有数据</el-button>
            </div>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title">数据存储说明</div>
            <div class="text-secondary" style="font-size: 13px; line-height: 1.8">
              所有业务数据保存在本机浏览器存储（IndexedDB，异常时自动降级 localStorage），完全离线运行，不会上传到任何服务器。<br />
              应用重启后数据自动恢复。建议定期使用「导出全部数据」进行备份。<br />
              注意：清空浏览器缓存 / 卸载应用可能删除本地数据，重要数据请先导出。
            </div>
          </div>
        </div>
      </el-tab-pane>
      <!-- 管理员文件 -->
      <el-tab-pane label="管理员文件" name="pwd">
        <div class="settings-content">
          <div class="glass-card setting-card">
            <div class="setting-title flex-between">
              <span>pwd 管理员密码文件状态</span>
              <el-button size="small" @click="refreshPwdStatus">刷新检查</el-button>
            </div>
            <el-descriptions :column="1" border size="small" class="mt12">
              <el-descriptions-item label="文件状态">
                <el-tag :type="pwdStatus?.exists ? 'success' : 'info'" size="small">
                  {{ pwdStatus?.exists ? '已存在' : '不存在' }}
                </el-tag>
                <span class="text-secondary" style="margin-left: 8px; font-size: 12px">
                  {{ pwdStatus?.exists ? '可用该密码直接登录' : '未启用时仅支持普通密码登录' }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="文件路径">{{ pwdStatus?.path ?? '—' }}</el-descriptions-item>
              <el-descriptions-item label="所在目录">
                {{ pwdStatus?.dir ?? '—' }}
                <el-tag v-if="pwdStatus && !pwdStatus.writable" type="danger" size="small" style="margin-left: 8px">无写入权限</el-tag>
              </el-descriptions-item>
            </el-descriptions>

            <div class="mt12">
              <el-button type="warning" @click="pwdCreateVisible = true">生成 / 更新 pwd 文件</el-button>
              <span class="text-secondary" style="font-size: 12px; margin-left: 10px">不会显示文件中已存在的密码明文</span>
            </div>
          </div>

          <div class="glass-card setting-card">
            <div class="setting-title">pwd 文件使用说明</div>
            <ol class="usage-list">
              <li>文件名必须为 <code>pwd</code>（无扩展名），内容直接填写管理员密码文本。</li>
              <li>普通密码与管理员密码都可以打开程序；登录时输入其中任意一个即可。</li>
              <li>管理员密码由主进程读取与校验，不会保存在浏览器存储中。</li>
              <li>文件优先放在可执行文件所在目录；若该目录无写入权限，会自动使用应用数据目录。</li>
              <li>不要把管理员密码文件提交到公开代码仓库。</li>
            </ol>
          </div>
        </div>
      </el-tab-pane>

      <!-- 关于 -->
      <el-tab-pane label="关于" name="about">
        <div class="settings-content">
          <div class="glass-card setting-card about-card">
            <div class="about-logo">
              <img :src="appLogo" alt="软件图标" />
            </div>
            <div class="about-name">牛奶智慧班级积分</div>
            <div class="about-version">v{{ appInfo?.version ?? '1.0.1B23' }}</div>
            <div class="about-desc">让每一分进步都被看见 —— 纯本地离线的班级积分管理桌面应用</div>
            <el-descriptions :column="2" border size="small" class="mt16" style="max-width: 640px">
              <el-descriptions-item label="版本">v{{ appInfo?.version ?? '1.0.1B23' }}</el-descriptions-item>
              <el-descriptions-item label="作者">GB牛奶</el-descriptions-item>
              <el-descriptions-item label="数据存储">本地 IndexedDB / localStorage，离线可用</el-descriptions-item>
              <el-descriptions-item label="版权信息">Copyright © 2026 GB牛奶 · 保留所有权利</el-descriptions-item>
            </el-descriptions>
            <div class="about-copy">Copyright © 2026 GB牛奶 · 牛奶智慧班级积分 · 保留所有权利</div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 生成 pwd 文件对话框 -->
    <el-dialog v-model="pwdCreateVisible" title="生成 / 更新管理员密码文件" width="440px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="管理员密码" required>
          <el-input v-model="pwdCreateForm.password" type="password" show-password placeholder="将写入 pwd 文件" />
        </el-form-item>
        <el-form-item label="确认密码" required>
          <el-input v-model="pwdCreateForm.confirm" type="password" show-password placeholder="再次输入" @keyup.enter="createPwdFile" />
        </el-form-item>
      </el-form>
      <div class="text-secondary" style="font-size: 12px">
        文件将优先写入可执行文件所在目录；无权限时自动使用应用数据目录。更新会覆盖旧密码。
      </div>
      <template #footer>
        <el-button @click="pwdCreateVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdCreating" @click="createPwdFile">写入文件</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<style scoped>
.settings-tabs :deep(.el-tabs__header) {
  margin-right: 18px;
}
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 860px;
}
.setting-card {
  padding: 18px 20px;
}
.setting-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 14px;
}
.mb12 {
  margin-bottom: 12px;
}
.mt12 {
  margin-top: 12px;
}
.mt16 {
  margin-top: 16px;
}

/* 主题网格 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px;
}
.theme-item {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}
.theme-item:hover {
  background: rgba(127, 146, 173, 0.1);
}
.theme-item.active {
  border-color: var(--el-color-primary);
  background: rgba(59, 130, 246, 0.08);
}
.theme-swatch {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}
.theme-name {
  font-size: 12px;
  color: var(--app-text-secondary);
}
.theme-name.active {
  color: var(--el-color-primary);
  font-weight: 700;
}

.bg-preview {
  width: 100%;
  max-width: 480px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
}
.bg-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed var(--app-card-border);
}
.switch-row:last-child {
  border-bottom: none;
}
.switch-label {
  font-size: 14px;
  font-weight: 600;
}

.reason-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
}
.reason-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(127, 146, 173, 0.07);
}
.reason-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}
.reason-text {
  flex: 1;
  font-size: 13px;
}

.usage-list {
  margin: 0;
  padding-left: 20px;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 2;
}
.usage-list code {
  background: rgba(127, 146, 173, 0.15);
  padding: 1px 6px;
  border-radius: 6px;
  color: var(--el-color-primary);
}

.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.avatar-preview {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hidden-input {
  display: none;
}
.about-logo {
  width: 76px;
  height: 76px;
  border-radius: 20px;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  box-shadow: 0 8px 22px rgba(59, 130, 246, 0.35);
  overflow: hidden;
}
.about-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.app-logo-preview {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
}
.app-logo-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.about-name {
  margin-top: 14px;
  font-size: 22px;
  font-weight: 800;
}
.about-version {
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 13px;
}
.about-desc {
  margin-top: 8px;
  color: var(--app-text-secondary);
  font-size: 13px;
}
.about-copy {
  margin-top: 18px;
  color: var(--app-text-secondary);
  font-size: 12px;
}
</style>
