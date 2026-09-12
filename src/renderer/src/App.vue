<script setup lang="ts">
import { computed, watch } from 'vue'
import { useDataStore } from './stores/data'
import { applyTheme } from './themes'

const data = useDataStore()
const settings = computed(() => data.state.settings)

// 主题 / 深浅模式 / 自定义背景 变更后立即生效（不刷新页面）
watch(
  () => [settings.value.theme, settings.value.themeMode, settings.value.backgroundImage] as const,
  ([theme, mode, bg]) => applyTheme(theme, mode, bg),
  { immediate: true }
)

// 跟随系统主题时监听系统变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (settings.value.themeMode === 'system') {
    applyTheme(settings.value.theme, 'system', settings.value.backgroundImage)
  }
})
</script>

<template>
  <router-view />
</template>
