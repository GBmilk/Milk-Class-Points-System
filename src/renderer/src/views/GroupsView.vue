<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, User, TrendCharts, Minus, Picture } from '@element-plus/icons-vue'
import type { Group, Student } from '../types'
import { useDataStore } from '../stores/data'
import { useAuthStore } from '../stores/auth'
import { compressImageFile, PRODUCT_IMG_SIZE } from '../utils/image'
import { pinyinFirst } from '../utils/pinyin'
import { formatDateTime } from '../utils/date'

const route = useRoute()
const data = useDataStore()
const auth = useAuthStore()
const s = () => data.state

// ===== 班级信息设置 =====
const classForm = reactive({
  className: '',
  classSlogan: '',
  classIntro: '',
  teacherName: ''
})

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
  ElMessage.success('班级信息已更新，主界面同步生效')
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

// ===== 小组列表 =====
const rankedGroups = computed(() => {
  return [...s().groups]
    .map((g) => ({ ...g, points: data.groupPoints(g.id), memberCount: data.groupMembers(g.id).length, rank: data.groupRank(g.id) }))
    .sort((a, b) => a.rank - b.rank || (a.createdAt < b.createdAt ? -1 : 1))
})

const ungroupedStudents = computed(() => s().students.filter((x) => x.enabled && !x.groupId))

// ===== 创建 / 编辑小组 =====
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<string | null>(null)
const GROUP_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#f97316', '#22c55e', '#eab308', '#ec4899']
const form = reactive({
  name: '',
  initial: '',
  color: GROUP_COLORS[0],
  icon: null as string | null,
  leaderId: null as string | null
})
const uploading = ref(false)

function openAdd(): void {
  isEdit.value = false
  editingId.value = null
  form.name = ''
  form.initial = ''
  form.color = GROUP_COLORS[0]
  form.icon = null
  form.leaderId = null
  dialogVisible.value = true
}

function openEdit(g: Group): void {
  isEdit.value = true
  editingId.value = g.id
  form.name = g.name
  form.initial = g.initial
  form.color = g.color
  form.icon = g.icon
  form.leaderId = g.leaderId
  dialogVisible.value = true
}

function autoInitial(): void {
  form.initial = pinyinFirst(form.name)
}

async function handleIcon(file: File): Promise<void> {
  try {
    uploading.value = true
    form.icon = await compressImageFile(file, { maxSize: PRODUCT_IMG_SIZE, quality: 0.85 })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '图片处理失败')
  } finally {
    uploading.value = false
  }
}

function onGroupIconUpload(options: { file: File }): Promise<void> {
  return handleIcon(options.file)
}

function saveGroup(): void {
  if (!form.name.trim()) {
    ElMessage.warning('请输入小组名称')
    return
  }
  if (isEdit.value && editingId.value) {
    data.updateGroup(editingId.value, {
      name: form.name,
      initial: form.initial || pinyinFirst(form.name),
      color: form.color,
      icon: form.icon,
      leaderId: form.leaderId
    })
    ElMessage.success('小组已更新')
  } else {
    data.addGroup({
      name: form.name,
      initial: form.initial || pinyinFirst(form.name),
      color: form.color,
      icon: form.icon,
      leaderId: form.leaderId
    })
    ElMessage.success('小组创建成功')
  }
  dialogVisible.value = false
}

function removeGroup(g: Group): void {
  const members = data.groupMembers(g.id).length
  ElMessageBox.confirm(
    `确定删除小组「${g.name}」吗？组内 ${members} 名学生将变为「未分组」，学生与积分数据不会丢失。`,
    '删除小组确认',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      data.removeGroup(g.id)
      ElMessage.success('小组已删除，组员已变为未分组')
    })
    .catch(() => {})
}
// ===== 小组详情抽屉 =====
const detailVisible = ref(false)
const detailGroup = ref<Group | null>(null)
const addMemberIds = ref<string[]>([])
const groupOpMode = ref<'add' | 'deduct'>('add')
const groupOpScore = ref(1)
const groupOpReason = ref('')
const groupOpCustom = ref('')
const groupOpSubmitting = ref(false)

function openDetail(g: Group): void {
  detailGroup.value = g
  addMemberIds.value = []
  groupOpMode.value = 'add'
  groupOpScore.value = 1
  groupOpReason.value = ''
  groupOpCustom.value = ''
  detailVisible.value = true
}

const detailMembers = computed(() => (detailGroup.value ? data.groupMembers(detailGroup.value.id) : []))
const candidateStudents = computed(() => s().students.filter((x) => x.enabled && !x.groupId))
const detailGroupPoints = computed(() => (detailGroup.value ? data.groupPoints(detailGroup.value.id) : 0))
const detailGroupRank = computed(() => (detailGroup.value ? data.groupRank(detailGroup.value.id) : 0))

const groupOpReasons = computed(() =>
  groupOpMode.value === 'add' ? s().settings.addReasons : s().settings.deductReasons
)
const groupOpTotal = computed(() => detailMembers.value.length * Math.max(0, Math.floor(groupOpScore.value)))

function addMembersToGroup(): void {
  if (!detailGroup.value) return
  if (addMemberIds.value.length === 0) {
    ElMessage.warning('请先选择要加入的学生')
    return
  }
  data.setStudentGroup(addMemberIds.value, detailGroup.value.id)
  ElMessage.success(`已将 ${addMemberIds.value.length} 名学生加入「${detailGroup.value.name}」`)
  addMemberIds.value = []
}

function removeMember(stu: Student): void {
  if (!detailGroup.value) return
  data.setStudentGroup([stu.id], null)
  ElMessage.success(`已将「${stu.name}」移出小组`)
}

function submitGroupOp(): void {
  if (!detailGroup.value) return
  if (groupOpSubmitting.value) return
  if (detailMembers.value.length === 0) {
    ElMessage.warning('小组暂无成员，无法分配积分')
    return
  }
  const reason = (groupOpCustom.value || groupOpReason.value || '').trim()
  if (!reason) {
    ElMessage.warning('请选择或填写原因')
    return
  }
  const sc = Math.floor(groupOpScore.value)
  if (!Number.isInteger(sc) || sc <= 0) {
    ElMessage.warning('分数必须是正整数')
    return
  }
  groupOpSubmitting.value = true
  try {
    const ids = detailMembers.value.map((x) => x.id)
    const opts = { studentIds: ids, score: sc, reason, operatorType: auth.operatorType }
    const res = groupOpMode.value === 'add' ? data.addPoints(opts) : data.deductPoints(opts)
    if (!res.ok) {
      ElMessage.error(res.message ?? '操作失败')
      return
    }
    ElMessage.success(`小组${groupOpMode.value === 'add' ? '加分' : '减分'}成功，${res.count} 名学生每人 ${sc} 分`)
  } finally {
    groupOpSubmitting.value = false
  }
}

// 批量调整学生所属小组
const adjustVisible = ref(false)
const adjustGroupId = ref('')
const adjustStudentIds = ref<string[]>([])

function openAdjust(): void {
  adjustGroupId.value = ''
  adjustStudentIds.value = []
  adjustVisible.value = true
}

function submitAdjust(): void {
  if (adjustStudentIds.value.length === 0) {
    ElMessage.warning('请选择学生')
    return
  }
  data.setStudentGroup(adjustStudentIds.value, adjustGroupId.value || null)
  ElMessage.success(`已调整 ${adjustStudentIds.value.length} 名学生的所属小组`)
  adjustVisible.value = false
}

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
    <!-- 班级信息 -->
    <div class="glass-card class-card">
      <div class="class-head">
        <div class="class-emoji">
          <img v-if="s().settings.classAvatar" :src="s().settings.classAvatar ?? undefined" alt="" />
          <span v-else>🏫</span>
        </div>
        <div>
          <div class="class-name">{{ s().settings.className }}</div>
          <div class="class-slogan">{{ s().settings.classSlogan || '未设置班级口号' }}</div>
        </div>
        <el-button text type="primary" @click="saveClassInfo">保存班级信息</el-button>
      </div>
      <el-form label-width="80px" class="class-form">
        <el-form-item label="班级头像">
          <div class="flex gap8 items-center">
            <div class="class-emoji avatar-sm">
              <img v-if="s().settings.classAvatar" :src="s().settings.classAvatar ?? undefined" alt="" />
              <span v-else>🏫</span>
            </div>
            <input ref="avatarInput" type="file" accept="image/*" class="hidden-input" @change="uploadClassAvatar" />
            <el-button size="small" :loading="avatarUploading" @click="pickAvatar">从本地文件选择</el-button>
            <el-button v-if="s().settings.classAvatar" size="small" type="danger" plain @click="clearClassAvatar">清除</el-button>
            <span class="text-secondary" style="font-size: 12px">头像将从本地图片文件读取并持久化，建议正方形图片</span>
          </div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="班级名称">
              <el-input v-model="classForm.className" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="班主任">
              <el-input v-model="classForm.teacherName" placeholder="可选" maxlength="20" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="班级口号">
              <el-input v-model="classForm.classSlogan" maxlength="40" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="班级简介">
              <el-input v-model="classForm.classIntro" placeholder="可选" maxlength="100" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <!-- 小组工具栏 -->
    <div class="flex-between">
      <div class="page-title" style="font-size: 17px">小组管理（{{ s().groups.length }} 个）</div>
      <div class="flex gap8">
        <el-button :icon="User" @click="openAdjust">批量调整分组</el-button>
        <el-button type="primary" :icon="Plus" @click="openAdd">创建小组</el-button>
      </div>
    </div>

    <!-- 小组卡片 -->
    <div v-if="rankedGroups.length" class="group-grid">
      <div v-for="g in rankedGroups" :key="g.id" class="glass-card group-card hover-lift">
        <div class="group-head">
          <div class="group-icon" :style="{ background: g.color }">
            <img v-if="g.icon" :src="g.icon" alt="" />
            <span v-else>{{ g.initial || g.name.charAt(0) }}</span>
          </div>
          <div class="group-title-box">
            <div class="group-name ellipsis">{{ g.name }}</div>
            <div class="group-leader text-secondary">
              组长：{{ g.leaderId ? data.studentName(g.leaderId) : '未设置' }} · {{ g.memberCount }} 人
            </div>
          </div>
          <span class="rank-badge" :class="`rank-${g.rank}`">第 {{ g.rank }} 名</span>
        </div>

        <div class="group-points">
          <span class="points-num">{{ g.points }}</span>
          <span class="text-secondary">小组总积分</span>
        </div>

        <div class="member-strip">
          <div v-for="m in data.groupMembers(g.id).slice(0, 8)" :key="m.id" class="mini-member" :title="m.name">
            {{ m.name.charAt(0) }}
          </div>
          <span v-if="g.memberCount > 8" class="text-secondary" style="font-size: 12px">+{{ g.memberCount - 8 }}</span>
          <span v-if="g.memberCount === 0" class="text-secondary" style="font-size: 12px">暂无成员</span>
        </div>

        <div class="group-actions">
          <el-button size="small" type="primary" text @click="openDetail(g)">成员与加减分</el-button>
          <el-button size="small" text :icon="Edit" @click="openEdit(g)">编辑</el-button>
          <el-button size="small" text type="danger" :icon="Delete" @click="removeGroup(g)">删除</el-button>
        </div>
      </div>
    </div>

    <div v-else class="glass-card empty-state">
      <el-icon class="empty-icon"><User /></el-icon>
      <div style="font-size: 16px; font-weight: 600">还没有创建小组</div>
      <div class="text-secondary">创建小组后进行小组加分、小组 PK 更有趣</div>
      <el-button type="primary" :icon="Plus" @click="openAdd">创建小组</el-button>
    </div>
    <!-- 创建 / 编辑小组对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑小组' : '创建小组'" width="500px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="小组名称" required>
          <el-input v-model="form.name" placeholder="如：智慧星小组" maxlength="20" @blur="autoInitial" />
        </el-form-item>
        <el-form-item label="小组首字">
          <el-input v-model="form.initial" placeholder="自动取自名称拼音首字母" maxlength="2" style="width: 160px" />
          <el-button text type="primary" @click="autoInitial">自动</el-button>
        </el-form-item>
        <el-form-item label="颜色">
          <div class="color-palette">
            <span
              v-for="c in GROUP_COLORS"
              :key="c"
              class="color-dot"
              :class="{ active: form.color === c }"
              :style="{ background: c }"
              @click="form.color = c"
            ></span>
          </div>
        </el-form-item>
        <el-form-item label="自定义图标">
          <div class="flex gap12">
            <div v-if="form.icon" class="icon-preview">
              <img :src="form.icon" alt="" />
              <el-button text type="danger" size="small" class="icon-clear" @click="form.icon = null">移除</el-button>
            </div>
            <el-upload :show-file-list="false" accept="image/*" :http-request="onGroupIconUpload">
              <el-button :loading="uploading">上传图标</el-button>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="组长">
          <el-select v-model="form.leaderId" placeholder="选择组长" clearable style="width: 100%">
            <el-option v-for="stu in s().students.filter((x) => x.enabled)" :key="stu.id" :label="stu.name" :value="stu.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveGroup">保存</el-button>
      </template>
    </el-dialog>

    <!-- 小组详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detailGroup ? detailGroup.name : ''" size="620px">
      <template v-if="detailGroup">
        <div class="detail-summary glass-card">
          <div class="group-icon lg" :style="{ background: detailGroup.color }">
            <img v-if="detailGroup.icon" :src="detailGroup.icon" alt="" />
            <span v-else>{{ detailGroup.initial || detailGroup.name.charAt(0) }}</span>
          </div>
          <div>
            <div class="flex gap8 items-center">
              <b style="font-size: 17px">{{ detailGroup.name }}</b>
              <span class="rank-badge" :class="`rank-${detailGroupRank}`">第 {{ detailGroupRank }} 名</span>
            </div>
            <div class="text-secondary" style="font-size: 13px; margin-top: 4px">
              组长：{{ detailGroup.leaderId ? data.studentName(detailGroup.leaderId) : '未设置' }} · 成员 {{ detailMembers.length }} 人
            </div>
            <div style="margin-top: 6px">
              小组总积分：<b style="color: var(--el-color-primary); font-size: 20px">{{ detailGroupPoints }}</b>
            </div>
          </div>
        </div>

        <!-- 小组加减分 -->
        <div class="group-op glass-card mt16">
          <div class="config-title">小组集体{{ groupOpMode === 'add' ? '加分' : '减分' }}</div>
          <div class="flex gap8 mb12 items-center">
            <el-radio-group v-model="groupOpMode">
              <el-radio-button value="add">加分</el-radio-button>
              <el-radio-button value="deduct">减分</el-radio-button>
            </el-radio-group>
            <el-input-number v-model="groupOpScore" :min="1" :max="9999" size="small" />
            <span class="text-secondary" style="font-size: 13px">
              共 {{ detailMembers.length }} 人 × {{ Math.floor(groupOpScore) }} 分 = <b>{{ groupOpTotal }}</b> 分
            </span>
          </div>
          <div class="text-secondary mb12" style="font-size: 13px">选择原因：</div>
          <div class="reason-chips">
            <el-tag
              v-for="r in groupOpReasons"
              :key="r"
              class="reason-chip"
              :class="{ active: groupOpReason === r }"
              @click="groupOpReason = groupOpReason === r ? '' : r"
            >
              {{ r }}
            </el-tag>
          </div>
          <el-input v-model="groupOpCustom" class="mt12" placeholder="或输入自定义原因" maxlength="50" />
          <el-button
            :type="groupOpMode === 'add' ? 'success' : 'danger'"
            class="mt12"
            style="width: 100%"
            :loading="groupOpSubmitting"
            @click="submitGroupOp"
          >
            确认给全组{{ groupOpMode === 'add' ? '加分' : '减分' }}
          </el-button>
        </div>

        <!-- 成员管理 -->
        <div class="glass-card mt16 member-card">
          <div class="config-title flex-between">
            <span>成员管理（{{ detailMembers.length }}）</span>
            <el-button text type="primary" size="small" @click="addMemberIds = []">清空勾选</el-button>
          </div>
          <el-select v-model="addMemberIds" multiple filterable placeholder="从未分组学生中选择加入" style="width: 100%" class="mb12">
            <el-option v-for="stu in candidateStudents" :key="stu.id" :label="`${stu.name}（${stu.points} 分）`" :value="stu.id" />
          </el-select>
          <el-button size="small" type="primary" style="width: 100%" @click="addMembersToGroup">加入小组</el-button>

          <div class="member-list mt12">
            <div v-for="m in detailMembers" :key="m.id" class="member-row">
              <span class="member-avatar">{{ m.name.charAt(0) }}</span>
              <span class="member-name ellipsis">{{ m.name }}</span>
              <span class="member-pts">{{ m.points }} 分</span>
              <el-button text size="small" type="danger" @click="removeMember(m)">移出</el-button>
            </div>
            <div v-if="detailMembers.length === 0" class="empty-tip">暂无成员，请从上方选择学生加入</div>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- 批量调整分组对话框 -->
    <el-dialog v-model="adjustVisible" title="批量调整学生所属小组" width="520px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="目标小组">
          <el-select v-model="adjustGroupId" placeholder="未分组" clearable style="width: 100%">
            <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="选择学生">
          <el-select v-model="adjustStudentIds" multiple filterable placeholder="选择要调整的学生" style="width: 100%">
            <el-option v-for="stu in s().students.filter((x) => x.enabled)" :key="stu.id" :label="`${stu.name}（${data.groupName(stu.groupId)}）`" :value="stu.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdjust">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<style scoped>
.class-card {
  padding: 18px 20px;
}
.class-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.class-emoji {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
  overflow: hidden;
}
.class-emoji img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-sm {
  width: 44px;
  height: 44px;
  font-size: 22px;
  border-radius: 12px;
}
.hidden-input {
  display: none;
}
.class-name {
  font-size: 20px;
  font-weight: 800;
}
.class-slogan {
  font-size: 13px;
  color: var(--app-text-secondary);
}
.class-form {
  margin-top: 4px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.group-card {
  padding: 16px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.group-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  overflow: hidden;
  flex-shrink: 0;
}
.group-icon.lg {
  width: 54px;
  height: 54px;
  font-size: 22px;
}
.group-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.group-title-box {
  flex: 1;
  min-width: 0;
}
.group-name {
  font-weight: 700;
  font-size: 15px;
}
.group-leader {
  font-size: 12px;
}
.rank-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(127, 146, 173, 0.18);
  color: var(--app-text-secondary);
  flex-shrink: 0;
}
.rank-badge.rank-1 {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #fff;
}
.rank-badge.rank-2 {
  background: linear-gradient(135deg, #cbd5e1, #94a3b8);
  color: #fff;
}
.rank-badge.rank-3 {
  background: linear-gradient(135deg, #fdba74, #ea580c);
  color: #fff;
}

.group-points {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.points-num {
  font-size: 26px;
  font-weight: 800;
  color: var(--el-color-primary);
}
.member-strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.mini-member {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(127, 146, 173, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-secondary);
}
.group-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed var(--app-card-border);
  padding-top: 8px;
}

.color-palette {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.color-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.15s ease;
}
.color-dot:hover {
  transform: scale(1.15);
}
.color-dot.active {
  border-color: var(--app-text);
  box-shadow: 0 0 0 3px rgba(127, 146, 173, 0.2);
}
.icon-preview {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
}
.icon-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.icon-clear {
  position: absolute;
  right: -14px;
  top: -10px;
  font-size: 10px;
}

.detail-summary {
  padding: 14px 16px;
  display: flex;
  gap: 14px;
  align-items: center;
}
.group-op,
.member-card {
  padding: 14px 16px;
}
.config-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
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
.reason-chip.active {
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: #fff;
}
.member-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 260px;
  overflow-y: auto;
}
.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(127, 146, 173, 0.07);
}
.member-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--app-grad-a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.member-name {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
}
.member-pts {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-color-primary);
}
.empty-tip {
  text-align: center;
  color: var(--app-text-secondary);
  font-size: 13px;
  padding: 14px 0;
}
.items-center {
  align-items: center;
}
</style>
