<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  User,
  Grid,
  TrendCharts,
  Medal,
  ShoppingCart,
  Warning,
  Plus,
  Trophy,
  Sunrise,
  MagicStick
} from '@element-plus/icons-vue'
import { useDataStore } from '../stores/data'
import { resolveAppLogo } from '../utils/logo'
import { isToday, formatDateTime } from '../utils/date'
import { recordTypeLabel, signedScore } from '../utils/format'

const router = useRouter()
const data = useDataStore()
const s = () => data.state

/** 软件图标：本地 PNG（用户自定义 > 班级头像 > 内置牛奶图标） */
const appLogo = computed(() => resolveAppLogo(data.state.settings))

const totalStudents = computed(() => s().students.filter((x) => x.enabled).length)
const groupCount = computed(() => s().groups.length)
const totalPoints = computed(() => s().students.filter((x) => x.enabled).reduce((sum, x) => sum + x.points, 0))
const todayChange = computed(() =>
  s()
    .records.filter((r) => isToday(r.time))
    .reduce((sum, r) => sum + r.score, 0)
)
const topStudent = computed(() => {
  const list = [...s().students.filter((x) => x.enabled)].sort((a, b) => b.points - a.points)
  return list[0] ?? null
})
const onSaleCount = computed(() => s().products.filter((p) => p.status === 'on').length)
const outOfStockCount = computed(() => s().products.filter((p) => p.status === 'on' && p.stock <= 0).length)

const topStudents = computed(() => {
  return [...s().students.filter((x) => x.enabled)]
    .sort((a, b) => b.points - a.points || (a.createdAt < b.createdAt ? -1 : 1))
    .slice(0, 5)
    .map((x, i) => ({ ...x, rank: i + 1 }))
})
const topGroups = computed(() => {
  return [...s().groups]
    .map((g) => ({ g, points: data.groupPoints(g.id) }))
    .sort((a, b) => b.points - a.points || (a.g.createdAt < b.g.createdAt ? -1 : 1))
    .slice(0, 5)
    .map((x, i) => ({ ...x.g, rank: i + 1, points: x.points }))
})
const recentRecords = computed(() => {
  return [...s().records].sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, 8)
})

const pointsBarOption = computed(() => {
  const top = [...s().students.filter((x) => x.enabled)].sort((a, b) => b.points - a.points).slice(0, 10).reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } } },
    yAxis: { type: 'category', data: top.map((x) => x.name), axisLabel: { color: 'var(--app-text-secondary)' } },
    series: [
      {
        type: 'bar',
        data: top.map((x) => x.points),
        barWidth: 14,
        itemStyle: {
          borderRadius: [0, 7, 7, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'var(--app-grad-a)' },
              { offset: 1, color: 'var(--app-grad-b)' }
            ]
          }
        }
      }
    ]
  }
})

const quickActions = [
  { label: '添加学生', icon: Plus, to: '/students?new=1', type: 'primary' as const },
  { label: '快速加分', icon: Sunrise, to: '/points?tab=add', type: 'success' as const },
  { label: '快速减分', icon: TrendCharts, to: '/points?tab=deduct', type: 'danger' as const },
  { label: '添加商品', icon: ShoppingCart, to: '/store?new=1', type: 'warning' as const },
  { label: '创建小组', icon: Grid, to: '/groups?new=1', type: 'info' as const },
  { label: '幸运大转盘', icon: MagicStick, to: '/wheel', type: 'warning' as const }
]
</script>
<template>
  <div class="page">
    <div class="hero glass-card">
      <div class="hero-text">
        <div class="hero-title">{{ s().settings.className }}</div>
        <div class="hero-slogan">{{ s().settings.classSlogan || '团结 · 友爱 · 进步' }}</div>
        <div v-if="s().settings.teacherName" class="hero-sub">班主任：{{ s().settings.teacherName }}</div>
      </div>
      <div class="hero-emoji">
        <img :src="appLogo" alt="软件图标" />
      </div>
      <div class="quick-actions">
        <el-button v-for="a in quickActions" :key="a.label" :type="a.type" round size="small" @click="router.push(a.to)">
          <el-icon style="margin-right: 4px"><component :is="a.icon" /></el-icon>
          {{ a.label }}
        </el-button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="glass-card stat-card hover-lift">
        <div class="stat-label">学生总数</div>
        <div class="stat-value">{{ totalStudents }}</div>
        <el-icon class="stat-icon"><User /></el-icon>
      </div>
      <div class="glass-card stat-card hover-lift">
        <div class="stat-label">小组数量</div>
        <div class="stat-value">{{ groupCount }}</div>
        <el-icon class="stat-icon"><Grid /></el-icon>
      </div>
      <div class="glass-card stat-card hover-lift">
        <div class="stat-label">班级总积分</div>
        <div class="stat-value" style="color: var(--el-color-primary)">{{ totalPoints }}</div>
        <el-icon class="stat-icon"><TrendCharts /></el-icon>
      </div>
      <div class="glass-card stat-card hover-lift">
        <div class="stat-label">今日积分变动</div>
        <div class="stat-value" :style="{ color: todayChange >= 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)' }">
          {{ todayChange > 0 ? '+' : '' }}{{ todayChange }}
        </div>
        <el-icon class="stat-icon"><Sunrise /></el-icon>
      </div>
      <div class="glass-card stat-card hover-lift">
        <div class="stat-label">积分最高学生</div>
        <div class="stat-value" style="font-size: 20px">{{ topStudent ? `${topStudent.name} · ${topStudent.points}` : '—' }}</div>
        <el-icon class="stat-icon"><Medal /></el-icon>
      </div>
      <div class="glass-card stat-card hover-lift">
        <div class="stat-label">在售商品</div>
        <div class="stat-value">{{ onSaleCount }}</div>
        <el-icon class="stat-icon"><ShoppingCart /></el-icon>
      </div>
      <div class="glass-card stat-card hover-lift">
        <div class="stat-label">缺货商品</div>
        <div class="stat-value" :style="{ color: outOfStockCount > 0 ? 'var(--el-color-warning)' : 'inherit' }">
          {{ outOfStockCount }}
        </div>
        <el-icon class="stat-icon"><Warning /></el-icon>
      </div>
    </div>

    <div class="dash-grid">
      <div class="glass-card panel">
        <div class="panel-title">个人积分 Top 10</div>
        <VChart :option="pointsBarOption" autoresize style="height: 260px" />
      </div>
      <div class="glass-card panel">
        <div class="panel-title flex-between">
          <span>个人排行前 5</span>
          <el-button text type="primary" size="small" @click="router.push('/leaderboard')">查看全部</el-button>
        </div>
        <div class="rank-list">
          <div v-for="t in topStudents" :key="t.id" class="rank-row" @click="router.push('/leaderboard')">
            <span class="rank-no" :class="`rank-${t.rank}`">{{ t.rank }}</span>
            <span class="rank-name ellipsis">{{ t.name }}</span>
            <span v-if="t.groupId" class="rank-group text-secondary ellipsis">{{ data.groupName(t.groupId) }}</span>
            <span class="rank-pts">{{ t.points }} 分</span>
          </div>
          <div v-if="topStudents.length === 0" class="empty-tip">暂无学生数据，去添加学生吧</div>
        </div>
      </div>
      <div class="glass-card panel">
        <div class="panel-title flex-between">
          <span>小组排行前 5</span>
          <el-button text type="primary" size="small" @click="router.push('/leaderboard')">查看全部</el-button>
        </div>
        <div class="rank-list">
          <div v-for="t in topGroups" :key="t.id" class="rank-row" @click="router.push('/leaderboard')">
            <span class="rank-no" :class="`rank-${t.rank}`">{{ t.rank }}</span>
            <span class="group-avatar" :style="{ background: t.color }">{{ t.initial || '组' }}</span>
            <span class="rank-name ellipsis">{{ t.name }}</span>
            <span class="rank-group text-secondary ellipsis">{{ data.groupMembers(t.id).length }} 人</span>
            <span class="rank-pts">{{ t.points }} 分</span>
          </div>
          <div v-if="topGroups.length === 0" class="empty-tip">暂无小组，去创建小组吧</div>
        </div>
      </div>
    </div>
    <div class="glass-card panel">
      <div class="panel-title flex-between">
        <span>最近积分记录</span>
        <el-button text type="primary" size="small" @click="router.push('/records')">查看全部</el-button>
      </div>
      <el-table :data="recentRecords" size="small" style="width: 100%">
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
        </el-table-column>
        <el-table-column label="学生" width="110">
          <template #default="{ row }">{{ data.studentName(row.studentId) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.type === 'add' ? 'success' : row.type === 'deduct' ? 'danger' : row.type === 'purchase' ? 'warning' : 'info'"
            >
              {{ recordTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分数" width="90">
          <template #default="{ row }">
            <span
              :style="{
                color: row.score > 0 ? 'var(--el-color-success)' : row.score < 0 ? 'var(--el-color-danger)' : 'var(--app-text-secondary)',
                fontWeight: 600
              }"
            >
              {{ signedScore(row.score) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="原因" prop="reason" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作前 → 操作后" width="150">
          <template #default="{ row }">{{ row.beforePoints ?? '—' }} → {{ row.afterPoints ?? '—' }}</template>
        </el-table-column>
      </el-table>
      <div v-if="recentRecords.length === 0" class="empty-state">
        <el-icon class="empty-icon"><Trophy /></el-icon>
        <span>还没有积分记录</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  padding: 22px 26px;
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(120deg, var(--app-grad-a), var(--app-grad-b));
  color: #fff;
  border: none;
  flex-wrap: wrap;
}
.hero-text {
  flex: 1;
  min-width: 200px;
}
.hero-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 1px;
}
.hero-slogan {
  font-size: 14px;
  opacity: 0.92;
  margin-top: 4px;
}
.hero-sub {
  font-size: 12px;
  opacity: 0.85;
  margin-top: 4px;
}
.hero-emoji {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  opacity: 0.9;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}
.hero-emoji img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
}
.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 1100px) {
  .dash-grid {
    grid-template-columns: 1fr;
  }
}
.panel {
  padding: 16px 18px;
}
.panel-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.rank-row:hover {
  background: rgba(127, 146, 173, 0.12);
}
.rank-no {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: rgba(127, 146, 173, 0.2);
  color: var(--app-text-secondary);
  flex-shrink: 0;
}
.rank-no.rank-1 {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #fff;
}
.rank-no.rank-2 {
  background: linear-gradient(135deg, #cbd5e1, #94a3b8);
  color: #fff;
}
.rank-no.rank-3 {
  background: linear-gradient(135deg, #fdba74, #ea580c);
  color: #fff;
}
.rank-name {
  font-weight: 600;
  flex: 1;
}
.rank-group {
  font-size: 12px;
  max-width: 120px;
}
.rank-pts {
  font-weight: 700;
  color: var(--el-color-primary);
  font-size: 13px;
}
.group-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.empty-tip {
  text-align: center;
  color: var(--app-text-secondary);
  padding: 18px 0;
  font-size: 13px;
}
</style>
