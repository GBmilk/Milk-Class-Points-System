<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Minus, ShoppingCart, User } from '@element-plus/icons-vue'
import { useDataStore, actualPrice } from '../stores/data'
import { useAuthStore } from '../stores/auth'
import { signedScore } from '../utils/format'

const route = useRoute()
const data = useDataStore()
const auth = useAuthStore()
const s = () => data.state

const activeTab = ref('add')

// ===== 加分 / 减分共用状态 =====
const opMode = ref<'single' | 'batch' | 'group'>('single')
const singleStudentId = ref('')
const batchIds = ref<string[]>([])
const groupTargetId = ref('')
const score = ref(1)
const selectedReason = ref('')
const customReason = ref('')
const submitting = ref(false)

const enabledStudents = computed(() => s().students.filter((x) => x.enabled))

function resetOperation(): void {
  opMode.value = 'single'
  singleStudentId.value = ''
  batchIds.value = []
  groupTargetId.value = ''
  score.value = 1
  selectedReason.value = ''
  customReason.value = ''
  submitting.value = false
}

const activeReasons = computed(() =>
  activeTab.value === 'add' ? s().settings.addReasons : s().settings.deductReasons
)

const reasonText = computed(() => (customReason.value.trim() || selectedReason.value || '').trim())

// 目标学生列表与预览
const targetStudentIds = computed(() => {
  if (opMode.value === 'single') return singleStudentId.value ? [singleStudentId.value] : []
  if (opMode.value === 'batch') return [...batchIds.value]
  if (opMode.value === 'group') {
    return s().students.filter((x) => x.groupId === groupTargetId.value && x.enabled).map((x) => x.id)
  }
  return []
})

const targetStudents = computed(() => {
  return targetStudentIds.value.map((id) => data.studentById(id)).filter((x): x is NonNullable<typeof x> => !!x)
})

const totalScore = computed(() => targetStudentIds.value.length * Math.max(0, Math.floor(score.value)))

// 批量选择
const allBatchSelected = computed(() => {
  return enabledStudents.value.length > 0 && enabledStudents.value.every((x) => batchIds.value.includes(x.id))
})

function toggleAllBatch(): void {
  if (allBatchSelected.value) batchIds.value = []
  else batchIds.value = enabledStudents.value.map((x) => x.id)
}

function selectBatchByGroup(groupId: string): void {
  const ids = s().students.filter((x) => x.groupId === groupId && x.enabled).map((x) => x.id)
  const set = new Set(batchIds.value)
  ids.forEach((id) => set.add(id))
  batchIds.value = [...set]
}

function toggleBatchId(id: string): void {
  if (batchIds.value.includes(id)) batchIds.value = batchIds.value.filter((x) => x !== id)
  else batchIds.value.push(id)
}

// 提交加 / 减分（防重复提交）
function submitOperation(): void {
  if (submitting.value) return
  const ids = targetStudentIds.value
  if (ids.length === 0) {
    ElMessage.warning(opMode.value === 'single' ? '请选择学生' : '请选择目标')
    return
  }
  const sc = Math.floor(score.value)
  if (!Number.isInteger(sc) || sc <= 0) {
    ElMessage.warning('分数必须是正整数')
    return
  }
  if (!reasonText.value) {
    ElMessage.warning('请选择或填写原因')
    return
  }
  submitting.value = true
  try {
    const opts = {
      studentIds: ids,
      score: sc,
      reason: reasonText.value,
      operatorType: auth.operatorType
    }
    const res = activeTab.value === 'add' ? data.addPoints(opts) : data.deductPoints(opts)
    if (!res.ok) {
      ElMessage.error(res.message ?? '操作失败')
      return
    }
    ElMessage.success(`${activeTab.value === 'add' ? '加分' : '减分'}成功，共影响 ${res.count} 人`)
    resetOperation()
  } finally {
    submitting.value = false
  }
}
// ===== 购买模块 =====
const buyStudentId = ref('')
const buyProductId = ref('')
const buying = ref(false)

const buyStudent = computed(() => data.studentById(buyStudentId.value))
const onSaleProducts = computed(() => s().products.filter((p) => p.status === 'on'))
const buyProduct = computed(() => data.productById(buyProductId.value))
const buyPrice = computed(() => (buyProduct.value ? actualPrice(buyProduct.value) : 0))

const canBuy = computed(() => {
  if (!buyStudent.value || !buyProduct.value) return false
  if (buyProduct.value.status !== 'on') return false
  if (buyProduct.value.stock <= 0) return false
  if (!s().settings.allowNegativePurchase && buyStudent.value.points < buyPrice.value) return false
  return buyPrice.value > 0
})

const buyBlockReason = computed(() => {
  if (!buyStudent.value || !buyProduct.value) return ''
  if (buyProduct.value.stock <= 0) return '商品缺货'
  if (!s().settings.allowNegativePurchase && buyStudent.value.points < buyPrice.value) return '积分不足'
  return ''
})

function submitPurchase(): void {
  if (buying.value) return
  if (!buyStudent.value || !buyProduct.value) return
  if (!canBuy.value) {
    ElMessage.warning(buyBlockReason.value || '当前条件无法购买')
    return
  }
  ElMessageBox.confirm(
    `确认让「${buyStudent.value.name}」花费 <b>${buyPrice.value}</b> 分购买「${buyProduct.value.name}」吗？购买后积分：${buyStudent.value.points - buyPrice.value} 分。`,
    '购买确认',
    {
      confirmButtonText: '确认购买',
      cancelButtonText: '取消',
      type: 'warning',
      dangerouslyUseHTMLString: true
    }
  )
    .then(() => {
      buying.value = true
      try {
        const res = data.purchase(buyStudent.value!.id, buyProduct.value!.id)
        if (!res.ok) {
          ElMessage.error(res.message ?? '购买失败')
          return
        }
        ElMessage.success('购买成功，积分与库存已更新')
        buyProductId.value = ''
      } finally {
        buying.value = false
      }
    })
    .catch(() => {})
}

// ===== 初始化：支持从其他页面带参数跳转 =====
function applyQuery(): void {
  const tab = String(route.query.tab ?? '')
  if (['add', 'deduct', 'buy'].includes(tab)) activeTab.value = tab as 'add' | 'deduct' | 'buy'
  const stuId = String(route.query.studentId ?? '')
  if (stuId) {
    if (activeTab.value === 'buy') {
      buyStudentId.value = stuId
    } else {
      opMode.value = 'single'
      singleStudentId.value = stuId
    }
  }
  const prodId = String(route.query.productId ?? '')
  if (prodId && activeTab.value === 'buy') buyProductId.value = prodId
}

onMounted(applyQuery)
watch(() => route.query, applyQuery)
</script>
<template>
  <div class="page">
    <el-tabs v-model="activeTab" class="points-tabs">
      <!-- 加分 -->
      <el-tab-pane label="加分" name="add">
        <div class="op-grid">
          <div class="glass-card op-card">
            <div class="op-title">① 选择目标</div>
            <el-radio-group v-model="opMode" class="mb12">
              <el-radio-button value="single">单个学生</el-radio-button>
              <el-radio-button value="batch">批量学生</el-radio-button>
              <el-radio-button value="group">小组</el-radio-button>
            </el-radio-group>

            <template v-if="opMode === 'single'">
              <el-select v-model="singleStudentId" filterable placeholder="搜索并选择学生" style="width: 100%">
                <el-option v-for="stu in enabledStudents" :key="stu.id" :label="`${stu.name}（${stu.points} 分）`" :value="stu.id" />
              </el-select>
            </template>

            <template v-else-if="opMode === 'batch'">
              <div class="flex-between mb12">
                <div class="flex gap8">
                  <el-button size="small" @click="toggleAllBatch">{{ allBatchSelected ? '取消全选' : '全选' }}</el-button>
                  <el-select
                    v-if="s().groups.length"
                    size="small"
                    placeholder="按小组勾选"
                    style="width: 140px"
                    :model-value="''"
                    @change="selectBatchByGroup"
                  >
                    <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
                  </el-select>
                </div>
                <span class="text-secondary" style="font-size: 12px">已选 {{ batchIds.length }} 人</span>
              </div>
              <div class="batch-list">
                <div v-for="stu in enabledStudents" :key="stu.id" class="batch-row" @click="toggleBatchId(stu.id)">
                  <el-checkbox :model-value="batchIds.includes(stu.id)" @click.stop @change="toggleBatchId(stu.id)" />
                  <span class="batch-name">{{ stu.name }}</span>
                  <el-tag size="small" type="info" effect="plain">{{ data.groupName(stu.groupId) }}</el-tag>
                  <span class="batch-pts">{{ stu.points }} 分</span>
                </div>
              </div>
            </template>

            <template v-else>
              <el-select v-model="groupTargetId" placeholder="选择小组" style="width: 100%">
                <el-option v-for="g in s().groups" :key="g.id" :label="`${g.name}（${data.groupMembers(g.id).length} 人）`" :value="g.id" />
              </el-select>
            </template>

            <div v-if="targetStudents.length" class="target-summary">
              将作用于 <b>{{ targetStudentIds.length }}</b> 人：
              <span class="ellipsis">{{ targetStudents.map((x) => x.name).slice(0, 6).join('、') }}{{ targetStudentIds.length > 6 ? ' 等' : '' }}</span>
            </div>
          </div>

          <div class="glass-card op-card">
            <div class="op-title">② 分数与原因</div>
            <div class="flex gap12 items-center mb12">
              <span>分数</span>
              <el-input-number v-model="score" :min="1" :max="9999" />
              <span class="text-secondary">分</span>
            </div>
            <div class="text-secondary mb12" style="font-size: 13px">常用{{ activeTab === 'add' ? '加分' : '减分' }}原因：</div>
            <div class="reason-chips">
              <el-tag
                v-for="r in activeReasons"
                :key="r"
                class="reason-chip"
                :class="{ active: selectedReason === r }"
                @click="selectedReason = selectedReason === r ? '' : r"
              >
                {{ r }}
              </el-tag>
            </div>
            <el-input v-model="customReason" class="mt12" placeholder="或输入自定义原因" maxlength="50" />

            <div class="preview-bar">
              <div class="preview-row">
                <span>影响人数</span><b>{{ targetStudentIds.length }}</b>
                <span>每人 {{ score }} 分</span>
                <span>总计</span><b :style="{ color: activeTab === 'add' ? 'var(--el-color-success)' : 'var(--el-color-danger)' }">{{ signedScore(totalScore) }}</b>
              </div>
            </div>

            <el-button
              type="success"
              size="large"
              class="submit-btn"
              :loading="submitting"
              :icon="Plus"
              @click="submitOperation"
            >
              确认加分
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 减分 -->
      <el-tab-pane label="减分" name="deduct">
        <div class="op-grid">
          <div class="glass-card op-card">
            <div class="op-title">① 选择目标</div>
            <el-radio-group v-model="opMode" class="mb12">
              <el-radio-button value="single">单个学生</el-radio-button>
              <el-radio-button value="batch">批量学生</el-radio-button>
              <el-radio-button value="group">小组</el-radio-button>
            </el-radio-group>

            <template v-if="opMode === 'single'">
              <el-select v-model="singleStudentId" filterable placeholder="搜索并选择学生" style="width: 100%">
                <el-option v-for="stu in enabledStudents" :key="stu.id" :label="`${stu.name}（${stu.points} 分）`" :value="stu.id" />
              </el-select>
            </template>

            <template v-else-if="opMode === 'batch'">
              <div class="flex-between mb12">
                <div class="flex gap8">
                  <el-button size="small" @click="toggleAllBatch">{{ allBatchSelected ? '取消全选' : '全选' }}</el-button>
                  <el-select
                    v-if="s().groups.length"
                    size="small"
                    placeholder="按小组勾选"
                    style="width: 140px"
                    :model-value="''"
                    @change="selectBatchByGroup"
                  >
                    <el-option v-for="g in s().groups" :key="g.id" :label="g.name" :value="g.id" />
                  </el-select>
                </div>
                <span class="text-secondary" style="font-size: 12px">已选 {{ batchIds.length }} 人</span>
              </div>
              <div class="batch-list">
                <div v-for="stu in enabledStudents" :key="stu.id" class="batch-row" @click="toggleBatchId(stu.id)">
                  <el-checkbox :model-value="batchIds.includes(stu.id)" @click.stop @change="toggleBatchId(stu.id)" />
                  <span class="batch-name">{{ stu.name }}</span>
                  <el-tag size="small" type="info" effect="plain">{{ data.groupName(stu.groupId) }}</el-tag>
                  <span class="batch-pts">{{ stu.points }} 分</span>
                </div>
              </div>
            </template>

            <template v-else>
              <el-select v-model="groupTargetId" placeholder="选择小组" style="width: 100%">
                <el-option v-for="g in s().groups" :key="g.id" :label="`${g.name}（${data.groupMembers(g.id).length} 人）`" :value="g.id" />
              </el-select>
            </template>

            <div v-if="targetStudents.length" class="target-summary">
              将作用于 <b>{{ targetStudentIds.length }}</b> 人：
              <span class="ellipsis">{{ targetStudents.map((x) => x.name).slice(0, 6).join('、') }}{{ targetStudentIds.length > 6 ? ' 等' : '' }}</span>
            </div>
          </div>

          <div class="glass-card op-card">
            <div class="op-title">② 分数与原因</div>
            <div class="flex gap12 items-center mb12">
              <span>分数</span>
              <el-input-number v-model="score" :min="1" :max="9999" />
              <span class="text-secondary">分</span>
            </div>
            <div class="text-secondary mb12" style="font-size: 13px">常用减分原因：</div>
            <div class="reason-chips">
              <el-tag
                v-for="r in activeReasons"
                :key="r"
                class="reason-chip"
                :class="{ active: selectedReason === r }"
                @click="selectedReason = selectedReason === r ? '' : r"
              >
                {{ r }}
              </el-tag>
            </div>
            <el-input v-model="customReason" class="mt12" placeholder="或输入自定义原因" maxlength="50" />

            <el-alert
              v-if="!s().settings.allowNegative"
              title="已开启「不允许积分为负」：当有学生积分不足时，本次操作将整体取消并提示"
              type="info"
              :closable="false"
              class="mt12"
            />

            <div class="preview-bar">
              <div class="preview-row">
                <span>影响人数</span><b>{{ targetStudentIds.length }}</b>
                <span>每人 {{ score }} 分</span>
                <span>总计</span><b style="color: var(--el-color-danger)">{{ signedScore(-totalScore) }}</b>
              </div>
            </div>

            <el-button
              type="danger"
              size="large"
              class="submit-btn"
              :loading="submitting"
              :icon="Minus"
              @click="submitOperation"
            >
              确认减分
            </el-button>
          </div>
        </div>
      </el-tab-pane>
      <!-- 购买 -->
      <el-tab-pane label="购买" name="buy">
        <div class="op-grid">
          <div class="glass-card op-card">
            <div class="op-title">① 选择学生</div>
            <el-select v-model="buyStudentId" filterable placeholder="搜索并选择学生" style="width: 100%">
              <el-option v-for="stu in enabledStudents" :key="stu.id" :label="`${stu.name}（${stu.points} 分）`" :value="stu.id" />
            </el-select>
            <div v-if="buyStudent" class="student-info">
              <div class="avatar-mini">
                <img v-if="buyStudent.avatar" :src="buyStudent.avatar" alt="" />
                <el-icon v-else :size="18"><User /></el-icon>
              </div>
              <div>
                <div style="font-weight: 700">{{ buyStudent.name }}</div>
                <div class="text-secondary" style="font-size: 12px">
                  {{ data.groupName(buyStudent.groupId) }} · 当前积分 <b style="color: var(--el-color-primary)">{{ buyStudent.points }}</b> 分
                </div>
              </div>
            </div>

            <div class="op-title mt16">② 选择商品</div>
            <div v-if="onSaleProducts.length" class="product-select-list">
              <div
                v-for="p in onSaleProducts"
                :key="p.id"
                class="product-row"
                :class="{ selected: buyProductId === p.id, disabled: p.stock <= 0 }"
                @click="buyProductId = p.stock > 0 ? p.id : buyProductId"
              >
                <div class="product-thumb">
                  <img v-if="p.image" :src="p.image" alt="" />
                  <el-icon v-else :size="18"><ShoppingCart /></el-icon>
                </div>
                <div class="product-info">
                  <div class="product-name ellipsis">{{ p.name }}</div>
                  <div class="product-price">
                    <span class="price-now">{{ actualPrice(p) }} 分</span>
                    <span v-if="p.discount < 100" class="price-old">{{ p.originalPrice }} 分</span>
                    <el-tag v-if="p.discount < 100" size="small" type="danger" effect="plain">{{ p.discount }} 折</el-tag>
                  </div>
                </div>
                <div class="product-stock">
                  <el-tag v-if="p.stock <= 0" size="small" type="danger">缺货</el-tag>
                  <span v-else class="text-secondary" style="font-size: 12px">库存 {{ p.stock }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-tip">暂无上架商品，请先到「积分商店」添加</div>
          </div>

          <div class="glass-card op-card">
            <div class="op-title">购买结算</div>
            <div class="pay-row"><span>学生</span><b>{{ buyStudent?.name ?? '—' }}</b></div>
            <div class="pay-row"><span>当前积分</span><b style="color: var(--el-color-primary)">{{ buyStudent?.points ?? '—' }}</b></div>
            <div class="pay-row"><span>商品</span><b>{{ buyProduct?.name ?? '—' }}</b></div>
            <div class="pay-row"><span>商品价格</span><b>{{ buyPrice ? `${buyPrice} 分` : '—' }}</b></div>
            <div class="pay-row"><span>库存</span><b>{{ buyProduct ? buyProduct.stock : '—' }}</b></div>
            <div v-if="buyProduct && buyProduct.discount < 100" class="pay-row">
              <span>折扣</span><b class="text-secondary">{{ buyProduct.discount }} 折（原价 {{ buyProduct.originalPrice }} 分）</b>
            </div>
            <el-divider style="margin: 12px 0" />
            <div class="pay-row">
              <span>购买后积分</span>
              <b :style="{ color: buyStudent && buyPrice ? 'var(--el-color-primary)' : 'inherit' }">
                {{ buyStudent && buyPrice ? buyStudent.points - buyPrice : '—' }}
              </b>
            </div>
            <div v-if="buyBlockReason" class="block-tip">{{ buyBlockReason }}，无法购买</div>

            <el-button
              type="warning"
              size="large"
              class="submit-btn"
              :disabled="!canBuy"
              :loading="buying"
              :icon="ShoppingCart"
              @click="submitPurchase"
            >
              确认购买
            </el-button>
            <div class="text-secondary" style="font-size: 12px; text-align: center">
              {{ s().settings.allowNegativePurchase ? '已开启「允许购买后积分为负」' : '购买后积分不可为负' }}
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.points-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}
.op-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 1100px) {
  .op-grid {
    grid-template-columns: 1fr;
  }
}
.op-card {
  padding: 18px 20px;
}
.op-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}
.mb12 {
  margin-bottom: 12px;
}
.mt16 {
  margin-top: 16px;
}
.items-center {
  align-items: center;
}

.batch-list {
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--app-card-border);
  border-radius: 10px;
  padding: 6px;
}
.batch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.batch-row:hover {
  background: rgba(127, 146, 173, 0.12);
}
.batch-name {
  font-weight: 600;
  flex: 1;
}
.batch-pts {
  font-size: 13px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.target-summary {
  margin-top: 12px;
  background: rgba(127, 146, 173, 0.1);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  display: flex;
  gap: 4px;
  color: var(--app-text-secondary);
  min-width: 0;
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

.preview-bar {
  margin-top: 16px;
  background: linear-gradient(120deg, rgba(96, 165, 250, 0.14), rgba(37, 99, 235, 0.08));
  border-radius: 12px;
  padding: 12px 16px;
}
.preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--app-text-secondary);
  flex-wrap: wrap;
}
.preview-row b {
  color: var(--app-text);
  font-size: 16px;
}
.submit-btn {
  width: 100%;
  margin-top: 16px;
  border-radius: 10px;
  font-size: 15px;
  letter-spacing: 2px;
}

.student-info {
  margin-top: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  background: rgba(127, 146, 173, 0.1);
  border-radius: 10px;
  padding: 10px 12px;
}
.avatar-mini {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--app-card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
  flex-shrink: 0;
}
.avatar-mini img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.product-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-card-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.product-row:hover {
  border-color: var(--el-color-primary);
}
.product-row.selected {
  border-color: var(--el-color-primary);
  background: rgba(59, 130, 246, 0.08);
}
.product-row.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.product-thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(127, 146, 173, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-secondary);
  overflow: hidden;
  flex-shrink: 0;
}
.product-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.product-info {
  flex: 1;
  min-width: 0;
}
.product-name {
  font-weight: 600;
  font-size: 14px;
}
.product-price {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.price-now {
  color: var(--el-color-danger);
  font-weight: 700;
}
.price-old {
  color: var(--app-text-secondary);
  font-size: 12px;
  text-decoration: line-through;
}

.pay-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  font-size: 14px;
  color: var(--app-text-secondary);
}
.pay-row b {
  color: var(--app-text);
}
.block-tip {
  margin-top: 10px;
  background: rgba(244, 63, 94, 0.1);
  color: var(--el-color-danger);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
}
.empty-tip {
  text-align: center;
  color: var(--app-text-secondary);
  padding: 24px 0;
  font-size: 13px;
}
</style>
