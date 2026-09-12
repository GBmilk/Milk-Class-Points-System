<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Delete, Sort, Filter, User } from '@element-plus/icons-vue'
import type { Gender, Student } from '../types'
import { useDataStore, sortStudentsByPinyin } from '../stores/data'
import { useAuthStore } from '../stores/auth'
import { compressImageFile, AVATAR_SIZE } from '../utils/image'
import { formatDateTime } from '../utils/date'
import { recordTypeLabel, signedScore } from '../utils/format'
import StudentCard from '../components/StudentCard.vue'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const auth = useAuthStore()
const s = () => data.state

// ===== 筛选与排序 =====
const keyword = ref('')
const groupFilter = ref('')
const genderFilter = ref('')
const sortMode = ref<'pinyin' | 'points-desc' | 'points-asc' | 'created'>('pinyin')
const showDisabled = ref(false)

const filteredStudents = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  let list = s().students.filter((x) => showDisabled.value || x.enabled)
  if (groupFilter.value) list = list.filter((x) => x.groupId === groupFilter.value)
  if (genderFilter.value) list = list.filter((x) => x.gender === genderFilter.value)
  if (kw) {
    list = list.filter((x) => {
      const g = data.groupName(x.groupId).toLowerCase()
      return x.name.toLowerCase().includes(kw) || g.includes(kw)
    })
  }
  return list
})

const sortedStudents = computed(() => {
  const list = [...filteredStudents.value]
  switch (sortMode.value) {
    case 'points-desc':
      return list.sort((a, b) => b.points - a.points || (a.createdAt < b.createdAt ? -1 : 1))
    case 'points-asc':
      return list.sort((a, b) => a.points - b.points || (a.createdAt < b.createdAt ? -1 : 1))
    case 'created':
      return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    default:
      return sortStudentsByPinyin(list)
  }
})

// 排名（按积分从高到低，仅启用学生）
const rankMap = computed(() => {
  const map = new Map<string, number>()
  const sorted = [...s().students.filter((x) => x.enabled)].sort((a, b) => b.points - a.points || (a.createdAt < b.createdAt ? -1 : 1))
  sorted.forEach((x, i) => map.set(x.id, i + 1))
  return map
})

// ===== 批量选择（勾选模式） =====
const selectMode = ref(false)
const selectedIds = ref<string[]>([])

const allSelected = computed(() => {
  const visible = sortedStudents.value.map((x) => x.id)
  return visible.length > 0 && visible.every((id) => selectedIds.value.includes(id))
})

function toggleSelectAll(): void {
  const visible = sortedStudents.value.map((x) => x.id)
  if (allSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !visible.includes(id))
  } else {
    const set = new Set(selectedIds.value)
    visible.forEach((id) => set.add(id))
    selectedIds.value = [...set]
  }
}

function selectGroup(groupId: string): void {
  const ids = s().students.filter((x) => x.groupId === groupId && x.enabled).map((x) => x.id)
  const set = new Set(selectedIds.value)
  ids.forEach((id) => set.add(id))
  selectedIds.value = [...set]
}

function toggleSelect(id: string): void {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value.push(id)
  }
}
// ===== 学生表单 =====
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '',
  gender: 'male' as Gender,
  className: '',
  points: 0,
  groupId: null as string | null,
  avatar: null as string | null
})
const uploading = ref(false)

function openAdd(): void {
  isEdit.value = false
  editingId.value = null
  form.name = ''
  form.gender = 'male'
  form.className = s().settings.className || '我的班级'
  form.points = 0
  form.groupId = null
  form.avatar = null
  dialogVisible.value = true
}

function openEdit(stu: Student): void {
  isEdit.value = true
  editingId.value = stu.id
  form.name = stu.name
  form.gender = stu.gender
  form.className = stu.className
  form.points = 0
  form.groupId = stu.groupId
  form.avatar = stu.avatar
  dialogVisible.value = true
}

async function handleAvatar(file: File): Promise<void> {
  try {
    uploading.value = true
    form.avatar = await compressImageFile(file, { maxSize: AVATAR_SIZE, quality: 0.85 })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '图片处理失败')
  } finally {
    uploading.value = false
  }
}

function onAvatarUpload(options: { file: File }): Promise<void> {
  return handleAvatar(options.file)
}

function clearAvatar(): void {
  form.avatar = null
}

function saveStudent(): void {
  if (!form.name.trim()) {
    ElMessage.warning('请输入学生姓名')
    return
  }
  if (isEdit.value && editingId.value) {
    data.updateStudent(editingId.value, {
      name: form.name,
      gender: form.gender,
      className: form.className,
      groupId: form.groupId
    })
    ElMessage.success('学生信息已更新')
  } else {
    data.addStudent({
      name: form.name,
      gender: form.gender,
      className: form.className,
      points: form.points,
      groupId: form.groupId,
      avatar: form.avatar
    })
    ElMessage.success('学生添加成功')
  }
  dialogVisible.value = false
}

function removeOne(stu: Student): void {
  ElMessageBox.confirm(`确定删除学生「${stu.name}」吗？该学生的历史积分记录会保留。`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      data.removeStudents([stu.id])
      selectedIds.value = selectedIds.value.filter((x) => x !== stu.id)
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

function batchRemove(): void {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先勾选学生')
    return
  }
  ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 名学生吗？历史记录会保留。`, '批量删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      data.removeStudents(selectedIds.value)
      selectedIds.value = []
      ElMessage.success('批量删除完成')
    })
    .catch(() => {})
}

// ===== 批量加 / 减分对话框 =====
const batchDialogVisible = ref(false)
const batchMode = ref<'add' | 'deduct'>('add')
const batchScore = ref(1)
const batchReason = ref('')
const batchCustomReason = ref('')
const batchSubmitting = ref(false)

function pickGroup(groupId: string): void {
  if (!groupId) return
  selectGroup(groupId)
  ElMessage.success(`已按小组快速勾选`)
}

function openBatchDialog(mode: 'add' | 'deduct'): void {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先勾选学生（支持全选或按小组选择）')
    return
  }
  batchMode.value = mode
  batchScore.value = 1
  batchReason.value = ''
  batchCustomReason.value = ''
  batchDialogVisible.value = true
}

const batchReasons = computed(() => (batchMode.value === 'add' ? s().settings.addReasons : s().settings.deductReasons))
const batchTotalScore = computed(() => selectedIds.value.length * batchScore.value)

function submitBatch(): void {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请至少选择一个学生')
    return
  }
  const reason = (batchCustomReason.value || batchReason.value || '').trim()
  if (!reason) {
    ElMessage.warning('请选择或填写原因')
    return
  }
  batchSubmitting.value = true
  try {
    const opts = {
      studentIds: [...selectedIds.value],
      score: Math.floor(batchScore.value),
      reason,
      operatorType: auth.operatorType
    }
    const res = batchMode.value === 'add' ? data.addPoints(opts) : data.deductPoints(opts)
    if (!res.ok) {
      ElMessage.error(res.message ?? '操作失败')
      return
    }
    ElMessage.success(`${batchMode.value === 'add' ? '加分' : '减分'}成功，共影响 ${res.count} 名学生`)
    batchDialogVisible.value = false
    selectedIds.value = []
    selectMode.value = false
  } finally {
    batchSubmitting.value = false
  }
}

// ===== 跳转快捷操作 =====
function goPoints(tab: string, studentId: string): void {
  router.push({ path: '/points', query: { tab, studentId } })
}

function goBuy(studentId: string): void {
  router.push({ path: '/points', query: { tab: 'buy', studentId } })
}

// ===== 详情抽屉 =====
const detailVisible = ref(false)
const detailStudent = ref<Student | null>(null)

function openDetail(stu: Student): void {
  detailStudent.value = stu
  detailVisible.value = true
}

const detailRecords = computed(() => (detailStudent.value ? data.recordsOfStudent(detailStudent.value.id) : []))
const detailPurchases = computed(() => detailRecords.value.filter((r) => r.type === 'purchase'))

// 支持从首页快捷打开新增
onMounted(() => {
  if (route.query.new === '1') openAdd()
})
watch(
  () => route.query.new,
  (v) => {
    if (v === '1') openAdd()
  }
)
</script>

<template>
  <div class="page">
    <!-- 工具栏 -->
    <div class="glass-card toolbar">
      <div class="flex gap12 flex-1 flex-wrap">
        <el-input v-model="keyword" placeholder="搜索学生姓名 / 小组" clearable style="width: 220px" :prefix-icon="Search" />
        <el-select v-model="groupFilter" placeholder="全部小组" clearable style="width: 150px">
          <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
        <el-select v-model="genderFilter" placeholder="全部性别" clearable style="width: 120px">
          <el-option label="男生" value="male" />
          <el-option label="女生" value="female" />
        </el-select>
        <el-select v-model="sortMode" style="width: 150px">
          <el-option label="按姓名拼音排序" value="pinyin" />
          <el-option label="按积分从高到低" value="points-desc" />
          <el-option label="按积分从低到高" value="points-asc" />
          <el-option label="最近添加" value="created" />
        </el-select>
        <el-checkbox v-model="showDisabled">显示停用学生</el-checkbox>
      </div>
      <div class="flex gap8">
        <el-button type="primary" :icon="Plus" @click="openAdd">新增学生</el-button>
        <el-button :type="selectMode ? 'primary' : 'default'" @click="selectMode = !selectMode">
          {{ selectMode ? '退出批量' : '批量操作' }}
        </el-button>
        <template v-if="selectMode">
          <el-button @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</el-button>
          <el-select v-if="s().groups.length" placeholder="按小组选择" size="small" style="width: 130px" :model-value="''" @change="pickGroup">
            <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
          <el-button type="success" :disabled="selectedIds.length === 0" @click="openBatchDialog('add')">
            批量加分（{{ selectedIds.length }}）
          </el-button>
          <el-button type="danger" :disabled="selectedIds.length === 0" @click="openBatchDialog('deduct')">
            批量减分（{{ selectedIds.length }}）
          </el-button>
          <el-button type="danger" plain :disabled="selectedIds.length === 0" :icon="Delete" @click="batchRemove">
            删除
          </el-button>
        </template>
      </div>
    </div>

    <!-- 学生统计行 -->
    <div class="flex gap16 text-secondary" style="font-size: 13px">
      <span>共 {{ sortedStudents.length }} 名学生</span>
      <template v-if="selectMode">
        <span>已选 {{ selectedIds.length }} 人</span>
        <el-button text size="small" @click="selectedIds = []">清空选择</el-button>
      </template>
    </div>

    <!-- 学生卡片 -->
    <div v-if="sortedStudents.length" class="student-grid">
      <StudentCard
        v-for="stu in sortedStudents"
        :key="stu.id"
        :student="stu"
        :rank="rankMap.get(stu.id) ?? null"
        :selectable="selectMode"
        :selected="selectedIds.includes(stu.id)"
        @toggle="toggleSelect(stu.id)"
        @detail="openDetail(stu)"
        @edit="openEdit(stu)"
        @remove="removeOne(stu)"
        @add="goPoints('add', stu.id)"
        @deduct="goPoints('deduct', stu.id)"
        @buy="goBuy(stu.id)"
      />
    </div>

    <!-- 空状态 -->
    <div v-else class="glass-card empty-state">
      <el-icon class="empty-icon"><User /></el-icon>
      <div style="font-size: 16px; font-weight: 600">{{ keyword || groupFilter || genderFilter ? '没有找到匹配的学生' : '还没有学生' }}</div>
      <div class="text-secondary">点击右上角「新增学生」开始添加班级成员</div>
      <el-button v-if="!keyword && !groupFilter && !genderFilter" type="primary" :icon="Plus" @click="openAdd">新增学生</el-button>
    </div>
    <!-- 新增 / 编辑学生对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑学生' : '新增学生'" width="520px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" placeholder="请输入学生姓名" maxlength="20" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.gender">
            <el-radio-button value="male">男生</el-radio-button>
            <el-radio-button value="female">女生</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="班级">
          <el-input v-model="form.className" placeholder="班级名称" maxlength="30" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="初始积分">
          <el-input-number v-model="form.points" :min="0" :max="99999" style="width: 180px" />
        </el-form-item>
        <el-form-item label="所属小组">
          <el-select v-model="form.groupId" placeholder="未分组" clearable style="width: 100%">
            <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="头像">
          <div class="flex gap12">
            <div v-if="form.avatar" class="avatar-preview">
              <img :src="form.avatar" alt="" />
              <el-button text type="danger" size="small" class="avatar-clear" @click="clearAvatar">移除</el-button>
            </div>
            <el-upload :show-file-list="false" accept="image/*" :http-request="onAvatarUpload">
              <el-button :loading="uploading">上传头像</el-button>
            </el-upload>
            <span class="text-secondary" style="font-size: 12px">可选，支持 jpg / png，自动压缩</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStudent">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量加 / 减分对话框 -->
    <el-dialog v-model="batchDialogVisible" :title="batchMode === 'add' ? '批量加分' : '批量减分'" width="480px" :close-on-click-modal="false">
      <div class="batch-info">
        已选择 <b>{{ selectedIds.length }}</b> 名学生，每人
        <el-input-number v-model="batchScore" :min="1" :max="9999" size="small" style="width: 120px" />
        分，共影响 <b>{{ batchTotalScore }}</b> 分
      </div>
      <div class="mt12">
        <div class="text-secondary mb12" style="font-size: 13px">选择{{ batchMode === 'add' ? '加分' : '减分' }}原因：</div>
        <div class="reason-chips">
          <el-tag
            v-for="r in batchReasons"
            :key="r"
            class="reason-chip"
            :class="{ active: batchReason === r }"
            @click="batchReason = batchReason === r ? '' : r"
          >
            {{ r }}
          </el-tag>
        </div>
        <el-input v-model="batchCustomReason" class="mt12" placeholder="或输入自定义原因" maxlength="50" />
      </div>
      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button :type="batchMode === 'add' ? 'success' : 'danger'" :loading="batchSubmitting" @click="submitBatch">
          确认{{ batchMode === 'add' ? '加分' : '减分' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 学生详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detailStudent ? detailStudent.name : ''" size="560px">
      <template v-if="detailStudent">
        <div class="detail-head">
          <div class="avatar-big">
            <img v-if="detailStudent.avatar" :src="detailStudent.avatar" alt="" />
            <el-icon v-else :size="30"><User /></el-icon>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 700">{{ detailStudent.name }}</div>
            <div class="text-secondary" style="font-size: 13px">
              {{ detailStudent.gender === 'male' ? '男生' : '女生' }} · {{ detailStudent.className || '未设置班级' }} · {{ data.groupName(detailStudent.groupId) }}
            </div>
            <div class="detail-points">
              <span style="font-size: 26px; font-weight: 800; color: var(--el-color-primary)">{{ detailStudent.points }}</span>
              <span class="text-secondary"> 分 · 排名第 {{ rankMap.get(detailStudent.id) ?? '—' }}</span>
            </div>
          </div>
        </div>

        <el-tabs class="mt16">
          <el-tab-pane label="积分明细">
            <el-table :data="detailRecords" size="small" max-height="420">
              <el-table-column label="时间" width="140">
                <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
              </el-table-column>
              <el-table-column label="类型" width="70">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.type === 'add' ? 'success' : row.type === 'deduct' ? 'danger' : row.type === 'purchase' ? 'warning' : 'info'">
                    {{ recordTypeLabel(row.type) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="分数" width="70">
                <template #default="{ row }">
                  <span :style="{ color: row.score > 0 ? 'var(--el-color-success)' : 'var(--el-color-danger)', fontWeight: 700 }">
                    {{ signedScore(row.score) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="原因" prop="reason" min-width="140" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
          <el-tab-pane :label="`购买记录 (${detailPurchases.length})`">
            <el-table :data="detailPurchases" size="small" max-height="420">
              <el-table-column label="时间" width="140">
                <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
              </el-table-column>
              <el-table-column label="商品" width="120">
                <template #default="{ row }">{{ row.productName ?? '已删除商品' }}</template>
              </el-table-column>
              <el-table-column label="花费" width="80">
                <template #default="{ row }">-{{ Math.abs(row.score) }} 分</template>
              </el-table-column>
              <el-table-column label="剩余" width="80">
                <template #default="{ row }">{{ row.afterPoints }} 分</template>
              </el-table-column>
              <el-table-column label="备注" prop="note" min-width="100" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>
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

.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px;
}

.reason-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.reason-chip {
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}
.reason-chip:hover {
  transform: translateY(-1px);
}
.reason-chip.active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}

.batch-info {
  background: rgba(127, 146, 173, 0.1);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
}

.avatar-preview {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--el-color-primary);
}
.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-clear {
  position: absolute;
  right: -14px;
  top: -10px;
  font-size: 10px;
}

.detail-head {
  display: flex;
  gap: 16px;
  align-items: center;
}
.avatar-big {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--app-card-bg);
  border: 2px solid var(--app-card-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
  overflow: hidden;
  flex-shrink: 0;
}
.avatar-big img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.detail-points {
  margin-top: 6px;
}
</style>
