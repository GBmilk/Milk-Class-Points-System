<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Key, Hide, View, Medal, ShoppingCart, Trophy, Lock, DataAnalysis } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import { resolveAppLogo } from '../utils/logo'

const router = useRouter()
const auth = useAuthStore()
const data = useDataStore()

const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const shake = ref(false)
const version = ref('1.0.0')

/** 软件图标：本地 PNG（用户自定义 > 班级头像 > 内置牛奶图标） */
const appLogo = computed(() => resolveAppLogo(data.state.settings))

const features = [
  { icon: DataAnalysis, text: '积分加 / 减 / 购买，操作即记录' },
  { icon: Medal, text: '个人与小组双排行榜' },
  { icon: ShoppingCart, text: '积分商店与幸运大转盘' },
  { icon: Trophy, text: '班级荣誉墙' },
  { icon: Lock, text: '数据全部保存在本机，离线可用' }
]

async function doLogin(): Promise<void> {
  if (!password.value) {
    errorMsg.value = '请输入密码'
    shake.value = true
    setTimeout(() => (shake.value = false), 400)
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await auth.login(password.value)
    if (res.ok) {
      ElMessage.success('登录成功，欢迎回来')
      router.push('/')
    } else {
      errorMsg.value = res.message ?? '密码错误'
      shake.value = true
      setTimeout(() => (shake.value = false), 400)
    }
  } finally {
    loading.value = false
  }
}

function onEnter(): void {
  if (!loading.value) void doLogin()
}

onMounted(async () => {
  try {
    const info = await window.api.appInfo()
    version.value = info.version
  } catch {
    // 忽略
  }
})
</script>

<template>
  <div class="login-page">
    <div class="bg-layer bg-layer--gradient"></div>

    <div class="login-panel">
      <!-- 左侧品牌区 -->
      <div class="brand">
        <div class="deco deco-1"></div>
        <div class="deco deco-2"></div>
        <div class="deco deco-3"></div>

        <div class="brand-logo">
          <img :src="appLogo" alt="软件图标" />
        </div>
        <h1 class="brand-title">牛奶智慧班级积分</h1>
        <p class="brand-slogan">让每一分进步都被看见</p>

        <ul class="feature-list">
          <li v-for="f in features" :key="f.text">
            <el-icon :size="16"><component :is="f.icon" /></el-icon>
            <span>{{ f.text }}</span>
          </li>
        </ul>

        <div class="brand-foot">
          <span>班级管理好帮手 · 纯本地离线运行</span>
        </div>
      </div>

      <!-- 右侧登录卡片 -->
      <div class="login-side">
        <div class="login-card" :class="{ shake }">
          <div class="card-head">
            <div class="card-icon"><el-icon :size="22"><Key /></el-icon></div>
            <h2>欢迎回来</h2>
            <p class="card-sub">请输入登录密码</p>
          </div>

          <el-input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            size="large"
            class="pwd-input"
            @keyup.enter="onEnter"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
            <template #suffix>
              <el-icon class="pwd-eye" @click="showPassword = !showPassword">
                <Hide v-if="!showPassword" />
                <View v-else />
              </el-icon>
            </template>
          </el-input>

          <div v-if="errorMsg" class="error-tip">{{ errorMsg }}</div>
          <div v-else class="error-tip placeholder">
            {{ auth.failedCount > 0 ? `密码错误，已尝试 ${auth.failedCount} 次` : ' ' }}
          </div>

          <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="doLogin">
            登 录
          </el-button>

          <div class="login-foot">
            <span class="text-secondary">v{{ version }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.bg-layer--gradient {
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
}

.login-panel {
  position: relative;
  z-index: 2;
  width: min(940px, 92vw);
  height: min(600px, 86vh);
  display: flex;
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(15, 42, 90, 0.35);
  background: var(--app-card-bg);
  backdrop-filter: blur(14px);
}

.brand {
  flex: 1.15;
  position: relative;
  padding: 44px 40px;
  color: #fff;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.brand-logo {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  margin-bottom: 20px;
  backdrop-filter: blur(4px);
  overflow: hidden;
}
.brand-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 4px;
}
.brand-title {
  font-size: 28px;
  margin: 0 0 6px;
  letter-spacing: 1px;
}
.brand-slogan {
  font-size: 15px;
  opacity: 0.9;
  margin: 0 0 28px;
}
.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.feature-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px 14px;
  backdrop-filter: blur(4px);
}
.brand-foot {
  margin-top: auto;
  font-size: 12px;
  opacity: 0.8;
}

.deco {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}
.deco-1 {
  width: 260px;
  height: 260px;
  right: -80px;
  top: -60px;
}
.deco-2 {
  width: 160px;
  height: 160px;
  left: -40px;
  bottom: 80px;
  background: rgba(255, 255, 255, 0.08);
}
.deco-3 {
  width: 80px;
  height: 80px;
  right: 60px;
  bottom: 30px;
  background: rgba(255, 255, 255, 0.14);
}

.login-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
}
.login-card {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card-head {
  text-align: center;
  margin-bottom: 6px;
}
.card-icon {
  width: 54px;
  height: 54px;
  margin: 0 auto 12px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
}
.card-head h2 {
  margin: 0 0 4px;
  font-size: 22px;
}
.card-sub {
  margin: 0;
  color: var(--app-text-secondary);
  font-size: 13px;
}
.pwd-input {
  --el-input-border-radius: 10px;
}
.pwd-eye {
  cursor: pointer;
  color: var(--app-text-secondary);
}
.pwd-text {
  font-size: 12px;
  color: var(--app-text-secondary);
  word-break: break-all;
}
.error-tip {
  font-size: 13px;
  color: var(--el-color-danger);
  min-height: 18px;
  text-align: center;
}
.error-tip.placeholder {
  color: var(--app-text-secondary);
}
.login-btn {
  width: 100%;
  border-radius: 10px;
  font-size: 15px;
  letter-spacing: 4px;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  border: none;
}
.login-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.pwd-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--app-text-secondary);
  cursor: help;
}

@keyframes shakeX {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}
.shake {
  animation: shakeX 0.4s ease;
}
</style>

