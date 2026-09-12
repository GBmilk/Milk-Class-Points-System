<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Medal, Trophy } from '@element-plus/icons-vue'
import type { Student } from '../types'
import { useDataStore } from '../stores/data'
import { formatDateTime } from '../utils/date'
import { recordTypeLabel, signedScore } from '../utils/format'

const data = useDataStore()
const s = () => data.state
const activeTab = ref('personal')

// ===== 个人排行榜 =====
const keyword = ref('')
const groupFilter = ref('')

const rankedStudents = computed(() => {
  let list = s().students.filter((x) => x.enabled)
  const kw = keyword.value.trim().toLowerCase()
  if (kw) list = list.filter((x) => x.name.toLowerCase().includes(kw) || data.groupName(x.groupId).toLowerCase().includes(kw))
  if (groupFilter.value) list = list.filter((x) => x.groupId === groupFilter.value)
  return [...list]
    .sort((a, b) => b.points - a.points || (a.createdAt < b.createdAt ? -1 : 1))
    .map((x, i) => ({ ...x, rank: i + 1 }))
})

const podium = computed(() => rankedStudents.value.slice(0, 3))
const restList = computed(() => rankedStudents.value.slice(3))

const podiumOrder = computed(() => [podium.value[1], podium.value[0], podium.value[2]].filter(Boolean))

const personalBarOption = computed(() => {
  const top = rankedStudents.value.slice(0, 10).reverse()
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

// ===== 小组排行榜 =====
const rankedGroups = computed(() => {
  return [...s().groups]
    .map((g) => ({
      ...g,
      points: data.groupPoints(g.id),
      memberCount: data.groupMembers(g.id).length,
      leaderName: g.leaderId ? data.studentName(g.leaderId) : '未设置'
    }))
    .sort((a, b) => b.points - a.points || (a.createdAt < b.createdAt ? -1 : 1))
    .map((x, i) => ({ ...x, rank: i + 1 }))
})

const groupBarOption = computed(() => {
  const list = rankedGroups.value.slice(0, 10).reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } } },
    yAxis: { type: 'category', data: list.map((x) => x.name), axisLabel: { color: 'var(--app-text-secondary)' } },
    series: [
      {
        type: 'bar',
        data: list.map((x) => x.points),
        barWidth: 16,
        itemStyle: {
          borderRadius: [0, 7, 7, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: '#fbbf24' },
              { offset: 1, color: '#f59e0b' }
            ]
          }
        }
      }
    ]
  }
})

// ===== 学生详情弹窗 =====
const detailVisible = ref(false)
const detailStudent = ref<Student | null>(null)
const detailRecords = computed(() => (detailStudent.value ? data.recordsOfStudent(detailStudent.value.id).slice(0, 10) : []))

function openStudentDetail(stu: Student): void {
  detailStudent.value = stu
  detailVisible.value = true
}
</script>
<template>
  <div class="page">
    <el-tabs v-model="activeTab">
      <!-- 个人排行榜 -->
      <el-tab-pane label="个人排行榜" name="personal">
        <div class="glass-card toolbar">
          <div class="flex gap12 flex-wrap">
            <el-input v-model="keyword" placeholder="搜索学生姓名 / 小组" clearable style="width: 200px" :prefix-icon="Search" />
            <el-select v-model="groupFilter" placeholder="全部小组" clearable style="width: 150px">
              <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
            </el-select>
          </div>
          <span class="text-secondary" style="font-size: 13px">共 {{ rankedStudents.length }} 人</span>
        </div>

        <!-- 前三名领奖台 -->
        <div v-if="podium.length" class="podium">
          <div v-for="p in podiumOrder" :key="p.id" class="podium-col" :class="`podium-${p.rank}`">
            <div class="podium-medal">{{ p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉' }}</div>
            <div class="podium-avatar" :class="p.gender === 'male' ? 'male' : 'female'">
              <img v-if="p.avatar" :src="p.avatar" alt="" />
              <span v-else>{{ p.name.charAt(0) }}</span>
            </div>
            <div class="podium-name">{{ p.name }}</div>
            <div v-if="p.groupId" class="podium-group text-secondary">{{ data.groupName(p.groupId) }}</div>
            <div class="podium-pts">{{ p.points }} 分</div>
            <div class="podium-stand" :class="`stand-${p.rank}`"></div>
          </div>
        </div>

        <div class="dash-row">
          <div class="glass-card panel">
            <div class="panel-title">积分分布 Top 10</div>
            <VChart :option="personalBarOption" autoresize style="height: 280px" />
          </div>
          <div class="glass-card panel">
            <div class="panel-title">完整榜单</div>
            <div class="rank-list">
              <div v-for="r in rankedStudents" :key="r.id" class="rank-row" @click="openStudentDetail(r)">
                <span class="rank-no" :class="`rank-${r.rank}`">{{ r.rank }}</span>
                <span class="rank-name ellipsis">{{ r.name }}</span>
                <el-tag size="small" :type="r.gender === 'male' ? 'primary' : 'danger'" effect="plain">
                  {{ r.gender === 'male' ? '男' : '女' }}
                </el-tag>
                <span v-if="r.groupId" class="rank-group text-secondary ellipsis">{{ data.groupName(r.groupId) }}</span>
                <span class="rank-pts">{{ r.points }} 分</span>
              </div>
              <div v-if="rankedStudents.length === 0" class="empty-tip">暂无学生数据</div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 小组排行榜 -->
      <el-tab-pane label="小组排行榜" name="groups">
        <div class="dash-row">
          <div class="glass-card panel">
            <div class="panel-title">小组积分对比</div>
            <VChart :option="groupBarOption" autoresize style="height: 280px" />
          </div>
          <div class="glass-card panel">
            <div class="panel-title">小组榜单</div>
            <div class="rank-list">
              <div v-for="g in rankedGroups" :key="g.id" class="rank-row">
                <span class="rank-no" :class="`rank-${g.rank}`">{{ g.rank }}</span>
                <span class="group-avatar" :style="{ background: g.color }">
                  <img v-if="g.icon" :src="g.icon" alt="" />
                  <span v-else>{{ g.initial || g.name.charAt(0) }}</span>
                </span>
                <span class="rank-name ellipsis">{{ g.name }}</span>
                <span class="rank-group text-secondary ellipsis">组长：{{ g.leaderName }} · {{ g.memberCount }} 人</span>
                <span class="rank-pts">{{ g.points }} 分</span>
              </div>
              <div v-if="rankedGroups.length === 0" class="empty-tip">暂无小组数据</div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 学生详情 -->
    <el-dialog v-model="detailVisible" :title="detailStudent ? detailStudent.name : ''" width="480px">
      <template v-if="detailStudent">
        <div class="detail-head">
          <div class="avatar-big" :class="detailStudent.gender === 'male' ? 'male' : 'female'">
            <img v-if="detailStudent.avatar" :src="detailStudent.avatar" alt="" />
            <span v-else>{{ detailStudent.name.charAt(0) }}</span>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 17px">
              {{ detailStudent.name }}
              <el-tag size="small" :type="detailStudent.gender === 'male' ? 'primary' : 'danger'" effect="plain">
                {{ detailStudent.gender === 'male' ? '男生' : '女生' }}
              </el-tag>
            </div>
            <div class="text-secondary" style="font-size: 13px">
              <template v-if="detailStudent.groupId">{{ data.groupName(detailStudent.groupId) }} · </template>排名第 {{ rankedStudents.find((x) => x.id === detailStudent!.id)?.rank ?? '—' }}
            </div>
            <div style="margin-top: 4px">
              当前积分：<b style="color: var(--el-color-primary); font-size: 20px">{{ detailStudent.points }}</b> 分
            </div>
          </div>
        </div>
        <div class="panel-title mt16">最近记录</div>
        <el-table :data="detailRecords" size="small" max-height="260">
          <el-table-column label="时间" width="130">
            <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
          </el-table-column>
          <el-table-column label="类型" width="70">
            <template #default="{ row }">
              <el-tag size="small" :type="row.type === 'add' ? 'success' : row.type === 'deduct' ? 'danger' : 'warning'">
                {{ recordTypeLabel(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分数" width="70">
            <template #default="{ row }">
              <span :style="{ color: row.score >= 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)', fontWeight: 700 }">
                {{ signedScore(row.score) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="原因" prop="reason" min-width="120" show-overflow-tooltip />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>
<style scoped>
.toolbar {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* 领奖台 */
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 18px;
  padding: 20px 0 10px;
}
.podium-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 140px;
}
.podium-medal {
  font-size: 32px;
}
.podium-avatar {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 800;
  color: #fff;
  overflow: hidden;
  border: 3px solid #fff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}
.podium-avatar.male {
  background: linear-gradient(135deg, #60a5fa, #2563eb);
}
.podium-avatar.female {
  background: linear-gradient(135deg, #f9a8d4, #db2777);
}
.podium-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.podium-name {
  font-weight: 700;
}
.podium-group {
  font-size: 12px;
}
.podium-pts {
  font-weight: 800;
  color: var(--el-color-primary);
}
.podium-stand {
  width: 100%;
  border-radius: 10px 10px 0 0;
}
.stand-1 {
  height: 78px;
  background: linear-gradient(180deg, #fde68a, #f59e0b);
}
.stand-2 {
  height: 58px;
  background: linear-gradient(180deg, #e2e8f0, #94a3b8);
}
.stand-3 {
  height: 42px;
  background: linear-gradient(180deg, #fdba74, #ea580c);
}
.podium-1 {
  transform: scale(1.05);
}

.dash-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 14px;
  margin-top: 14px;
}
@media (max-width: 1100px) {
  .dash-row {
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
  gap: 4px;
  max-height: 560px;
  overflow-y: auto;
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
  width: 26px;
  height: 26px;
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
  min-width: 60px;
}
.rank-group {
  font-size: 12px;
  max-width: 160px;
}
.rank-pts {
  font-weight: 800;
  color: var(--el-color-primary);
  font-size: 14px;
}
.group-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}
.group-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.empty-tip {
  text-align: center;
  color: var(--app-text-secondary);
  padding: 18px 0;
  font-size: 13px;
}

.detail-head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.avatar-big {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: #fff;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar-big.male {
  background: linear-gradient(135deg, #60a5fa, #2563eb);
}
.avatar-big.female {
  background: linear-gradient(135deg, #f9a8d4, #db2777);
}
.avatar-big img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
