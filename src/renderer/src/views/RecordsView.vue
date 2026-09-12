<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Download, Delete, Document, RefreshLeft } from '@element-plus/icons-vue'
import type { PointsRecord, RecordType } from '../types'
import { useDataStore } from '../stores/data'
import { formatDateTime, formatDate, daysAgoKey, todayKey } from '../utils/date'
import { recordTypeLabel, signedScore, toCsv } from '../utils/format'

const data = useDataStore()
const s = () => data.state

// ===== 筛选 =====
const keyword = ref('')
const studentFilter = ref('')
const groupFilter = ref('')
const typeFilter = ref('')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = 20

const filteredRecords = computed(() => {
  let list = [...s().records]
  const kw = keyword.value.trim().toLowerCase()
  if (kw) list = list.filter((r) => r.reason.toLowerCase().includes(kw) || (r.productName ?? '').toLowerCase().includes(kw))
  if (studentFilter.value) list = list.filter((r) => r.studentId === studentFilter.value)
  if (groupFilter.value) list = list.filter((r) => r.groupId === groupFilter.value)
  if (typeFilter.value) list = list.filter((r) => r.type === typeFilter.value)
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    list = list.filter((r) => {
      const d = formatDate(r.time)
      return d >= dateRange.value![0] && d <= dateRange.value![1]
    })
  }
  return list.sort((a, b) => (a.time < b.time ? 1 : -1))
})

const pagedRecords = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredRecords.value.slice(start, start + pageSize)
})

const totalRecords = computed(() => filteredRecords.value.length)

// ===== 详情 =====
const detailVisible = ref(false)
const detailRecord = ref<PointsRecord | null>(null)

function openDetail(row: PointsRecord): void {
  detailRecord.value = row
  detailVisible.value = true
}

// ===== 删除 =====
function removeRecord(row: PointsRecord): void {
  ElMessageBox.confirm('确定删除这条积分记录吗？删除后不可恢复。', '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      data.removeRecord(row.id)
      ElMessage.success('记录已删除')
    })
    .catch(() => {})
}

// ===== 清空（二次确认） =====
function clearAll(): void {
  ElMessageBox.confirm(
    `确定清空全部 ${s().records.length} 条积分记录吗？此操作不可恢复。`,
    '清空确认',
    {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      return ElMessageBox.confirm('再次确认：清空后将无法查看任何历史积分记录，确定继续吗？', '二次确认', {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        type: 'error'
      })
    })
    .then(() => {
      data.clearRecords()
      ElMessage.success('积分记录已清空')
    })
    .catch(() => {})
}

// ===== 导出 =====
async function exportCsv(): Promise<void> {
  const rows: (string | number)[][] = [
    ['时间', '学生', '小组', '类型', '分数', '操作前积分', '操作后积分', '原因', '操作人', '商品', '备注']
  ]
  filteredRecords.value.forEach((r) => {
    rows.push([
      formatDateTime(r.time),
      data.studentName(r.studentId),
      data.groupName(r.groupId),
      recordTypeLabel(r.type),
      signedScore(r.score),
      r.beforePoints ?? '',
      r.afterPoints ?? '',
      r.reason,
      r.operatorType,
      r.productName ?? '',
      r.note
    ])
  })
  const csv = toCsv(rows)
  try {
    const path = await window.api.saveFile({
      title: '导出积分记录 CSV',
      defaultPath: `积分记录-${todayKey()}.csv`,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
    })
    if (!path) return
    const res = await window.api.writeFile(path, csv)
    if (res.ok) ElMessage.success(`已导出 ${filteredRecords.value.length} 条记录`)
    else ElMessage.error(res.error ?? '导出失败')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

async function exportJson(): Promise<void> {
  const payload = {
    app: 'milk-class-points',
    kind: 'records',
    exportedAt: new Date().toISOString(),
    count: filteredRecords.value.length,
    records: filteredRecords.value
  }
  try {
    const path = await window.api.saveFile({
      title: '导出积分记录 JSON',
      defaultPath: `积分记录-${todayKey()}.json`,
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (!path) return
    const res = await window.api.writeFile(path, JSON.stringify(payload, null, 2))
    if (res.ok) ElMessage.success(`已导出 ${filteredRecords.value.length} 条记录`)
    else ElMessage.error(res.error ?? '导出失败')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

// ===== 快捷日期 =====
function setRange(days: number): void {
  dateRange.value = [daysAgoKey(days), todayKey()]
}
function resetFilters(): void {
  keyword.value = ''
  studentFilter.value = ''
  groupFilter.value = ''
  typeFilter.value = ''
  dateRange.value = null
  page.value = 1
}
</script>
<template>
  <div class="page">
    <!-- 筛选栏 -->
    <div class="glass-card toolbar">
      <div class="flex gap12 flex-wrap">
        <el-input v-model="keyword" placeholder="搜索原因 / 商品" clearable style="width: 200px" :prefix-icon="Search" />
        <el-select v-model="studentFilter" filterable placeholder="按学生筛选" clearable style="width: 160px">
          <el-option v-for="stu in s().students" :key="stu.id" :label="stu.name" :value="stu.id" />
        </el-select>
        <el-select v-model="groupFilter" placeholder="按小组筛选" clearable style="width: 150px">
          <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
        <el-select v-model="typeFilter" placeholder="按类型筛选" clearable style="width: 130px">
          <el-option label="加分" value="add" />
          <el-option label="减分" value="deduct" />
          <el-option label="购买" value="purchase" />
          <el-option label="其他" value="other" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
        <el-button text size="small" @click="setRange(7)">近7天</el-button>
        <el-button text size="small" @click="setRange(30)">近30天</el-button>
        <el-button text size="small" :icon="RefreshLeft" @click="resetFilters">重置</el-button>
      </div>
      <div class="flex gap8">
        <el-button :icon="Download" @click="exportCsv">导出 CSV</el-button>
        <el-button :icon="Document" @click="exportJson">导出 JSON</el-button>
        <el-button type="danger" plain :icon="Delete" :disabled="s().records.length === 0" @click="clearAll">清空记录</el-button>
      </div>
    </div>

    <div class="glass-card table-card">
      <div class="flex-between mb12">
        <span class="text-secondary" style="font-size: 13px">
          共 {{ totalRecords }} 条记录{{ dateRange ? '（当前筛选区间）' : '' }}
        </span>
        <div class="flex gap8">
          <el-tag size="small" type="success">加分 = 绿色</el-tag>
          <el-tag size="small" type="danger">减分 = 红色</el-tag>
          <el-tag size="small" type="warning">购买 = 橙色</el-tag>
        </div>
      </div>

      <el-table :data="pagedRecords" size="default" style="width: 100%" :empty-text="'没有符合条件的积分记录'">
        <el-table-column label="时间" width="150">
          <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
        </el-table-column>
        <el-table-column label="学生" width="100">
          <template #default="{ row }">{{ data.studentName(row.studentId) }}</template>
        </el-table-column>
        <el-table-column label="小组" width="90">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ data.groupName(row.groupId) }}</el-tag>
          </template>
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
                fontWeight: 700,
                fontSize: '15px'
              }"
            >
              {{ signedScore(row.score) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作前 → 后" width="120">
          <template #default="{ row }">{{ row.beforePoints ?? '—' }} → {{ row.afterPoints ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="原因" prop="reason" min-width="170" show-overflow-tooltip />
        <el-table-column label="商品" width="120">
          <template #default="{ row }">
            <span v-if="row.productName" class="product-snapshot">{{ row.productName }}</span>
            <span v-else class="text-secondary">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="80">
          <template #default="{ row }">{{ row.operatorType }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button text size="small" type="primary" @click="openDetail(row as PointsRecord)">详情</el-button>
            <el-button text size="small" type="danger" @click="removeRecord(row as PointsRecord)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex-between mt16">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="totalRecords"
          layout="prev, pager, next, total"
          background
          small
        />
      </div>
    </div>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="记录详情" width="480px">
      <template v-if="detailRecord">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="时间">{{ formatDateTime(detailRecord.time) }}</el-descriptions-item>
          <el-descriptions-item label="学生">{{ data.studentName(detailRecord.studentId) }}</el-descriptions-item>
          <el-descriptions-item label="小组">{{ data.groupName(detailRecord.groupId) }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ recordTypeLabel(detailRecord.type) }}</el-descriptions-item>
          <el-descriptions-item label="分数">
            <span :style="{ color: detailRecord.score > 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)', fontWeight: 700 }">
              {{ signedScore(detailRecord.score) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="操作前积分">{{ detailRecord.beforePoints ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="操作后积分">{{ detailRecord.afterPoints ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="原因">{{ detailRecord.reason }}</el-descriptions-item>
          <el-descriptions-item label="商品">{{ detailRecord.productName ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ detailRecord.operatorType }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detailRecord.note || '—' }}</el-descriptions-item>
        </el-descriptions>
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
.table-card {
  padding: 16px 18px;
  flex: 1;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}
.table-card :deep(.el-table) {
  flex: 1;
}
.product-snapshot {
  font-size: 12px;
  color: var(--el-color-warning);
}
</style>
