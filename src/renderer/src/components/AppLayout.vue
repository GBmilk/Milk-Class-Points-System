<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeFilled,
  User,
  TrendCharts,
  Document,
  ShoppingCart,
  Grid,
  Medal,
  Trophy,
  Setting,
  Moon,
  Sunny,
  Expand,
  Fold,
  SwitchButton,
  ArrowDown,
  MagicStick
} from '@element-plus/icons-vue'
import { useDataStore } from '../stores/data'
import { useAuthStore } from '../stores/auth'
import { resolveAppLogo } from '../utils/logo'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const auth = useAuthStore()

const collapsed = ref(localStorage.getItem('mcp:sidebar-collapsed') === '1')
const appInfo = ref<{ version: string } | null>(null)
const isDark = ref(false)

/** 软件图标：本地 PNG（用户自定义 > 班级头像 > 内置牛奶图标） */
const appLogo = computed(() => resolveAppLogo(data.state.settings))

const navItems = [
  { path: '/', name: '首页', icon: HomeFilled },
  { path: '/students', name: '学生管理', icon: User },
  { path: '/points', name: '积分管理', icon: TrendCharts },
  { path: '/records', name: '积分记录', icon: Document },
  { path: '/store', name: '积分商店', icon: ShoppingCart },
  { path: '/wheel', name: '幸运大转盘', icon: MagicStick },
  { path: '/groups', name: '小组管理', icon: Grid },
  { path: '/leaderboard', name: '排行榜', icon: Medal },
  { path: '/honors', name: '班级荣誉', icon: Trophy },
  { path: '/settings', name: '系统设置', icon: Setting }
]

const pageTitle = computed(() => String(route.meta.title ?? '首页'))
const className = computed(() => data.state.settings.className || '我的班级')
const studentCount = computed(() => data.state.students.length)
const groupCount = computed(() => data.state.groups.length)

function toggleCollapse(): void {
  collapsed.value = !collapsed.value
  localStorage.setItem('mcp:sidebar-collapsed', collapsed.value ? '1' : '0')
}

function toggleDark(): void {
  const cur = data.state.settings.themeMode
  const next = cur === 'dark' ? 'light' : 'dark'
  data.updateSettings({ themeMode: next })
  isDark.value = next === 'dark'
}

function logout(): void {
  auth.logout()
  router.push('/login')
  ElMessage.success('已退出登录')
}

onMounted(async () => {
  try {
    appInfo.value = await window.api.appInfo()
  } catch {
    appInfo.value = { version: '1.0.0' }
  }
})
</script>

<template>
  <div class="app-shell">
    <div class="bg-layer" :class="data.state.settings.backgroundImage ? 'bg-layer--image' : 'bg-layer--gradient'"></div>
    <aside class="sidebar" :class="{ collapsed }">
      <div class="sidebar-logo" @click="router.push('/')">
        <div class="logo-badge">
          <img :src="appLogo" alt="软件图标" />
        </div>
        <div v-if="!collapsed" class="logo-text">
          <div class="logo-title">牛奶智慧</div>
          <div class="logo-sub">班级积分</div>
        </div>
      </div>

      <nav class="nav-list">
        <div
          v-for="item in navItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path, collapsed }"
          :title="collapsed ? item.name : ''"
          @click="router.push(item.path)"
        >
          <el-icon :size="18"><component :is="item.icon" /></el-icon>
          <span v-if="!collapsed" class="nav-label">{{ item.name }}</span>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="nav-item collapsed" :title="collapsed ? '退出登录' : ''" @click="logout">
          <el-icon :size="18"><SwitchButton /></el-icon>
          <span v-if="!collapsed" class="nav-label">退出登录</span>
        </div>
      </div>
    </aside>

    <div class="main-area">
      <header class="topbar">
        <div class="flex gap12">
          <el-button text :icon="collapsed ? Expand : Fold" class="collapse-btn" @click="toggleCollapse" />
          <div>
            <div class="page-title">{{ pageTitle }}</div>
          </div>
        </div>
        <div class="flex gap12">
          <el-tag effect="plain" round class="class-tag">
            <span class="tag-dot"></span>
            {{ className }} · {{ studentCount }} 名学生 · {{ groupCount }} 个小组
          </el-tag>
          <el-button circle :icon="isDark ? Sunny : Moon" :title="isDark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleDark" />
          <el-button type="primary" :icon="Setting" @click="router.push('/settings')">系统设置</el-button>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>

      <footer class="footer">
        <span>牛奶智慧班级积分 v{{ appInfo?.version ?? '1.0.0' }}</span>
        <span class="footer-sep">·</span>
        <span>所有数据保存在本机，离线可用</span>
        <span class="footer-sep">·</span>
        <span>当前身份：{{ auth.operatorType }}</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100%;
  position: relative;
  z-index: 1;
}

.sidebar {
  width: 216px;
  display: flex;
  flex-direction: column;
  background: var(--app-sidebar-bg);
  border-right: 1px solid var(--app-card-border);
  backdrop-filter: blur(12px);
  transition: width 0.25s ease;
  overflow: hidden;
  flex-shrink: 0;
}
.sidebar.collapsed {
  width: 64px;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 14px;
  cursor: pointer;
}
.logo-badge {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
  flex-shrink: 0;
  overflow: hidden;
}
.logo-badge img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 2px;
}
.logo-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--app-sidebar-text);
  line-height: 1.2;
}
.logo-sub {
  font-size: 12px;
  color: var(--app-text-secondary);
  letter-spacing: 2px;
}

.nav-list {
  flex: 1;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--app-sidebar-text);
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease, transform 0.1s ease;
  white-space: nowrap;
  user-select: none;
}
.nav-item:hover {
  background: rgba(255, 255, 255, 0.35);
}
html.dark .nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
.nav-item:active {
  transform: scale(0.97);
}
.nav-item.active {
  background: var(--app-sidebar-active);
  color: var(--app-grad-b);
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
html.dark .nav-item.active {
  color: #fff;
}
.nav-item.collapsed {
  justify-content: center;
  padding: 10px 0;
}
.sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--app-card-border);
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 58px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--app-card-bg);
  border-bottom: 1px solid var(--app-card-border);
  backdrop-filter: blur(12px);
  flex-shrink: 0;
  z-index: 5;
}
.collapse-btn {
  font-size: 18px;
}
.class-tag {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.tag-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-primary);
  margin-right: 6px;
}

.content {
  flex: 1;
  min-height: 0;
  position: relative;
}

.footer {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--app-text-secondary);
  background: transparent;
  flex-shrink: 0;
}
.footer-sep {
  opacity: 0.5;
}
</style>
