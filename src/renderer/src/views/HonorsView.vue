<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Trophy, Picture } from '@element-plus/icons-vue'
import type { Honor } from '../types'
import { useDataStore } from '../stores/data'
import { compressImageFile, HONOR_IMG_SIZE } from '../utils/image'
import { formatDate, formatDateTime } from '../utils/date'

const data = useDataStore()
const s = () => data.state

const sortedHonors = computed(() => [...s().honors].sort((a, b) => (a.awardedAt < b.awardedAt ? 1 : -1)))

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '',
  image: null as string | null,
  awardedAt: '',
  description: ''
})
const uploading = ref(false)

function openAdd(): void {
  isEdit.value = false
  editingId.value = null
  form.name = ''
  form.image = null
  form.awardedAt = new Date().toISOString().slice(0, 10)
  form.description = ''
  dialogVisible.value = true
}

function openEdit(h: Honor): void {
  isEdit.value = true
  editingId.value = h.id
  form.name = h.name
  form.image = h.image
  form.awardedAt = h.awardedAt.slice(0, 10)
  form.description = h.description
  dialogVisible.value = true
}

async function handleImage(file: File): Promise<void> {
  try {
    uploading.value = true
    form.image = await compressImageFile(file, { maxSize: HONOR_IMG_SIZE, quality: 0.82 })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '图片处理失败')
  } finally {
    uploading.value = false
  }
}

function onHonorImageUpload(options: { file: File }): Promise<void> {
  return handleImage(options.file)
}

function saveHonor(): void {
  if (!form.name.trim()) {
    ElMessage.warning('请输入荣誉名称')
    return
  }
  if (!form.awardedAt) {
    ElMessage.warning('请选择获奖时间')
    return
  }
  if (isEdit.value && editingId.value) {
    data.updateHonor(editingId.value, {
      name: form.name,
      image: form.image,
      awardedAt: form.awardedAt,
      description: form.description
    })
    ElMessage.success('荣誉已更新')
  } else {
    data.addHonor({
      name: form.name,
      image: form.image,
      awardedAt: form.awardedAt,
      description: form.description
    })
    ElMessage.success('荣誉添加成功')
  }
  dialogVisible.value = false
}

function removeHonor(h: Honor): void {
  ElMessageBox.confirm(`确定删除荣誉「${h.name}」吗？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      data.removeHonor(h.id)
      ElMessage.success('荣誉已删除')
    })
    .catch(() => {})
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <div class="page-title">班级荣誉墙</div>
        <div class="page-sub">记录班级与同学们的每一次荣耀时刻（共 {{ s().honors.length }} 项）</div>
      </div>
      <el-button type="primary" :icon="Plus" @click="openAdd">添加荣誉</el-button>
    </div>

    <div v-if="sortedHonors.length" class="honor-grid">
      <div v-for="h in sortedHonors" :key="h.id" class="glass-card honor-card hover-lift">
        <el-image v-if="h.image" :src="h.image" :preview-src-list="[h.image]" fit="cover" class="honor-img" preview-teleported />
        <div v-else class="honor-img honor-placeholder">
          <el-icon :size="40"><Trophy /></el-icon>
        </div>
        <div class="honor-body">
          <div class="honor-name ellipsis" :title="h.name">{{ h.name }}</div>
          <div class="honor-date">
            <el-icon :size="13"><Picture /></el-icon>
            {{ formatDate(h.awardedAt) }}
          </div>
          <div v-if="h.description" class="honor-desc">{{ h.description }}</div>
        </div>
        <div class="honor-actions">
          <el-button text size="small" type="primary" :icon="Edit" @click="openEdit(h)">编辑</el-button>
          <el-button text size="small" type="danger" :icon="Delete" @click="removeHonor(h)">删除</el-button>
        </div>
      </div>
    </div>

    <div v-else class="glass-card empty-state">
      <el-icon class="empty-icon"><Trophy /></el-icon>
      <div style="font-size: 16px; font-weight: 600">荣誉墙还空着</div>
      <div class="text-secondary">上传奖状图片，记录班级荣誉时刻</div>
      <el-button type="primary" :icon="Plus" @click="openAdd">添加第一项荣誉</el-button>
    </div>

    <!-- 新增 / 编辑荣誉 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑荣誉' : '添加荣誉'" width="500px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="荣誉名称" required>
          <el-input v-model="form.name" placeholder="如：校级优秀班集体" maxlength="40" />
        </el-form-item>
        <el-form-item label="荣誉图片">
          <div class="flex gap12">
            <div v-if="form.image" class="img-preview">
              <img :src="form.image" alt="" />
              <el-button text type="danger" size="small" class="img-clear" @click="form.image = null">移除</el-button>
            </div>
            <el-upload :show-file-list="false" accept="image/*" :http-request="onHonorImageUpload">
              <el-button :loading="uploading">上传奖状图片</el-button>
            </el-upload>
          </div>
        </el-form-item>
        <el-form-item label="获奖时间">
          <el-date-picker v-model="form.awardedAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="荣誉简介">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="奖状简介（可选）" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveHonor">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.honor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.honor-card {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.honor-img {
  height: 140px;
  width: 100%;
  display: block;
  cursor: zoom-in;
}
.honor-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(250, 204, 21, 0.25), rgba(245, 158, 11, 0.2));
  color: #f59e0b;
}
.honor-body {
  padding: 12px 14px;
  flex: 1;
}
.honor-name {
  font-weight: 700;
  font-size: 15px;
}
.honor-date {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.honor-desc {
  margin-top: 8px;
  font-size: 13px;
  color: var(--app-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.honor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  padding: 0 10px 10px;
}
.img-preview {
  position: relative;
  width: 120px;
  height: 90px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--app-card-border);
}
.img-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.img-clear {
  position: absolute;
  right: -8px;
  top: -8px;
}
</style>
