<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Minus, ShoppingCart, Edit, Delete, User, Female } from '@element-plus/icons-vue'
import type { Student } from '../types'
import { useDataStore } from '../stores/data'

const props = defineProps<{
  student: Student
  rank?: number | null
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'deduct'): void
  (e: 'buy'): void
  (e: 'detail'): void
  (e: 'edit'): void
  (e: 'remove'): void
  (e: 'toggle'): void
}>()

const data = useDataStore()
const isMale = computed(() => props.student.gender === 'male')
const groupName = computed(() => data.groupName(props.student.groupId))
const medal = computed(() =>
  props.rank === 1 ? '🥇' : props.rank === 2 ? '🥈' : props.rank === 3 ? '🥉' : ''
)
</script>

<template>
  <div
    class="student-card"
    :class="[isMale ? 'male' : 'female', { selectable, selected }]"
    @click="selectable ? emit('toggle') : emit('detail')"
  >
    <div class="card-top">
      <span class="class-name ellipsis">{{ student.className || ' ' }}</span>
      <span v-if="medal" class="medal">{{ medal }}</span>
      <el-checkbox v-if="selectable" :model-value="selected" @click.stop @change="emit('toggle')" />
      <div v-else class="mini-actions">
        <el-button text size="small" :icon="Edit" title="编辑" @click.stop="emit('edit')" />
        <el-button text size="small" type="danger" :icon="Delete" title="删除" @click.stop="emit('remove')" />
      </div>
    </div>

    <div class="avatar">
      <img v-if="student.avatar" :src="student.avatar" alt="" />
      <el-icon v-else :size="26"><component :is="isMale ? User : Female" /></el-icon>
    </div>

    <div class="name ellipsis">{{ student.name }}</div>
    <div class="points">
      <span class="points-num">{{ student.points }}</span>
      <span class="unit">分</span>
    </div>
    <div class="group-tag ellipsis">{{ groupName }}</div>

    <div class="actions">
      <el-button type="success" size="small" round :icon="Plus" @click.stop="emit('add')">加分</el-button>
      <el-button type="danger" size="small" round :icon="Minus" @click.stop="emit('deduct')">减分</el-button>
      <el-button type="warning" size="small" round :icon="ShoppingCart" @click.stop="emit('buy')">购买</el-button>
    </div>
  </div>
</template>

<style scoped>
.student-card {
  border-radius: 16px;
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  box-shadow: 0 4px 14px rgba(31, 45, 61, 0.07);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  position: relative;
  overflow: hidden;
}
.student-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(31, 45, 61, 0.13);
}

/* 性别基础底色：不随主题改变，保证男女视觉区分 */
.student-card.male {
  background: linear-gradient(150deg, rgba(147, 197, 253, 0.5), rgba(191, 219, 254, 0.35));
  border-color: rgba(96, 165, 250, 0.45);
}
.student-card.female {
  background: linear-gradient(150deg, rgba(251, 207, 232, 0.55), rgba(252, 231, 243, 0.4));
  border-color: rgba(244, 114, 182, 0.45);
}
html.dark .student-card.male {
  background: linear-gradient(150deg, rgba(37, 99, 235, 0.42), rgba(30, 58, 138, 0.3));
}
html.dark .student-card.female {
  background: linear-gradient(150deg, rgba(219, 39, 119, 0.4), rgba(157, 23, 77, 0.28));
}

.student-card.selectable.selected {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.card-top {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.class-name {
  font-size: 11px;
  color: var(--app-text-secondary);
  max-width: 60%;
}
.medal {
  font-size: 18px;
}
.mini-actions {
  display: flex;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.student-card:hover .mini-actions {
  opacity: 1;
}

.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--app-card-bg);
  border: 2px solid rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
  overflow: hidden;
  flex-shrink: 0;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.name {
  font-size: 17px;
  font-weight: 700;
  max-width: 100%;
}
.points {
  display: flex;
  align-items: baseline;
  gap: 2px;
}
.points-num {
  font-size: 24px;
  font-weight: 800;
  color: var(--app-grad-b);
}
html.dark .points-num {
  color: var(--app-grad-a);
}
.unit {
  font-size: 12px;
  color: var(--app-text-secondary);
}
.group-tag {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--app-card-border);
  border-radius: 20px;
  padding: 1px 10px;
  color: var(--app-text-secondary);
  max-width: 80%;
}

.actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.actions :deep(.el-button) {
  padding: 4px 8px;
  font-size: 12px;
}
</style>
