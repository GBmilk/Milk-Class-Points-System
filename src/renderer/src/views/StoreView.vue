<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Edit, Delete, Box, ShoppingCart, RefreshRight, Top, Bottom } from '@element-plus/icons-vue'
import type { Product } from '../types'
import { useDataStore, actualPrice } from '../stores/data'
import { compressImageFile, PRODUCT_IMG_SIZE } from '../utils/image'
import { formatDateTime } from '../utils/date'

const route = useRoute()
const data = useDataStore()
const s = () => data.state

// ===== 筛选 =====
const keyword = ref('')
const categoryFilter = ref('')
const statusFilter = ref('')

const categories = computed(() => {
  const set = new Set(s().products.map((p) => p.category).filter(Boolean))
  return [...set]
})

const visibleProducts = computed(() => {
  let list = s().products.filter((p) => p.status !== 'deleted')
  const kw = keyword.value.trim().toLowerCase()
  if (kw) list = list.filter((p) => p.name.toLowerCase().includes(kw) || p.category.toLowerCase().includes(kw))
  if (categoryFilter.value) list = list.filter((p) => p.category === categoryFilter.value)
  if (statusFilter.value === 'on') list = list.filter((p) => p.status === 'on')
  if (statusFilter.value === 'off') list = list.filter((p) => p.status === 'off')
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
})

// ===== 商品表单 =====
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '',
  category: '',
  description: '',
  image: null as string | null,
  originalPrice: 10,
  discount: 100,
  stock: 10,
  onSale: true
})
const uploading = ref(false)

const formActualPrice = computed(() => actualPrice({ originalPrice: form.originalPrice, discount: form.discount }))

function openAdd(): void {
  isEdit.value = false
  editingId.value = null
  form.name = ''
  form.category = ''
  form.description = ''
  form.image = null
  form.originalPrice = 10
  form.discount = 100
  form.stock = 10
  form.onSale = true
  dialogVisible.value = true
}

function openEdit(p: Product): void {
  isEdit.value = true
  editingId.value = p.id
  form.name = p.name
  form.category = p.category
  form.description = p.description
  form.image = p.image
  form.originalPrice = p.originalPrice
  form.discount = p.discount
  form.stock = p.stock
  form.onSale = p.status === 'on'
  dialogVisible.value = true
}

async function handleImage(file: File): Promise<void> {
  try {
    uploading.value = true
    form.image = await compressImageFile(file, { maxSize: PRODUCT_IMG_SIZE, quality: 0.82 })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '图片处理失败')
  } finally {
    uploading.value = false
  }
}

function onProductImageUpload(options: { file: File }): Promise<void> {
  return handleImage(options.file)
}

function saveProduct(): void {
  const name = form.name.trim()
  if (!name) {
    ElMessage.warning('请输入商品名称')
    return
  }
  if (!Number.isInteger(form.originalPrice) || form.originalPrice <= 0) {
    ElMessage.warning('价格必须是大于 0 的整数')
    return
  }
  if (!Number.isInteger(form.discount) || form.discount < 1 || form.discount > 100) {
    ElMessage.warning('折扣必须是 1-100 之间的整数')
    return
  }
  if (!Number.isInteger(form.stock) || form.stock < 0) {
    ElMessage.warning('库存必须是不小于 0 的整数')
    return
  }
  if (isEdit.value && editingId.value) {
    data.updateProduct(editingId.value, {
      name,
      category: form.category,
      description: form.description,
      image: form.image,
      originalPrice: form.originalPrice,
      discount: form.discount,
      stock: form.stock,
      status: form.onSale ? 'on' : 'off'
    })
    ElMessage.success('商品已更新')
  } else {
    data.addProduct({
      name,
      category: form.category,
      description: form.description,
      image: form.image,
      originalPrice: form.originalPrice,
      discount: form.discount,
      stock: form.stock,
      status: form.onSale ? 'on' : 'off'
    })
    ElMessage.success('商品已上架')
  }
  dialogVisible.value = false
}

// ===== 补货 =====
const restockVisible = ref(false)
const restockProduct = ref<Product | null>(null)
const restockQty = ref(1)

function openRestock(p: Product): void {
  restockProduct.value = p
  restockQty.value = 1
  restockVisible.value = true
}

const restockAfter = computed(() => (restockProduct.value ? restockProduct.value.stock + Math.max(0, Math.floor(restockQty.value)) : 0))

function submitRestock(): void {
  if (!restockProduct.value) return
  const qty = Math.floor(restockQty.value)
  if (!Number.isInteger(qty) || qty <= 0) {
    ElMessage.warning('补货数量必须是正整数')
    return
  }
  data.restockProduct(restockProduct.value.id, qty)
  ElMessage.success(`补货成功，当前库存 ${restockProduct.value.stock} 件`)
  restockVisible.value = false
}

// ===== 上架 / 下架 / 删除 =====
function toggleStatus(p: Product): void {
  data.toggleProductStatus(p.id)
  ElMessage.success(p.status === 'on' ? '商品已下架' : '商品已重新上架')
}

function removeProduct(p: Product): void {
  ElMessageBox.confirm(`「${p.name}」请选择处理方式（历史购买记录都会保留）：`, '删除商品', {
    confirmButtonText: '仅下架',
    cancelButtonText: '彻底删除',
    distinguishCancelAndClose: true,
    showClose: false,
    type: 'warning'
  })
    .then(() => {
      data.removeProduct(p.id, false)
      ElMessage.success('商品已下架，可随时重新上架')
    })
    .catch((action: string | 'close') => {
      if (action === 'cancel') {
        ElMessageBox.confirm(`确定彻底删除「${p.name}」吗？商品数据将无法恢复。`, '彻底删除确认', {
          confirmButtonText: '彻底删除',
          cancelButtonText: '取消',
          type: 'error'
        })
          .then(() => {
            data.removeProduct(p.id, true)
            ElMessage.success('商品已彻底删除')
          })
          .catch(() => {})
      }
    })
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
    <div class="glass-card toolbar">
      <div class="flex gap12 flex-wrap">
        <el-input v-model="keyword" placeholder="搜索商品名称 / 分类" clearable style="width: 200px" :prefix-icon="Search" />
        <el-select v-model="categoryFilter" placeholder="全部分类" clearable style="width: 140px">
          <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 130px">
          <el-option label="上架中" value="on" />
          <el-option label="已下架" value="off" />
        </el-select>
      </div>
      <div class="flex gap8">
        <el-button type="primary" :icon="Plus" @click="openAdd">新增商品</el-button>
      </div>
    </div>

    <!-- 商品网格 -->
    <div v-if="visibleProducts.length" class="product-grid">
      <div v-for="p in visibleProducts" :key="p.id" class="glass-card product-card hover-lift">
        <div class="product-img">
          <img v-if="p.image" :src="p.image" alt="" />
          <el-icon v-else :size="38"><Box /></el-icon>
          <span v-if="p.status === 'off'" class="off-tag">已下架</span>
          <span v-if="p.stock <= 0 && p.status === 'on'" class="soldout-tag">缺货</span>
        </div>
        <div class="product-body">
          <div class="flex-between">
            <div class="product-name ellipsis" :title="p.name">{{ p.name }}</div>
            <el-tag v-if="p.category" size="small" effect="plain">{{ p.category }}</el-tag>
          </div>
          <div class="price-row">
            <span class="price-now">{{ actualPrice(p) }} 分</span>
            <span v-if="p.discount < 100" class="price-old">{{ p.originalPrice }} 分</span>
            <el-tag v-if="p.discount < 100" size="small" type="danger" effect="dark" class="discount-tag">{{ p.discount }}折</el-tag>
          </div>
          <div class="stock-row">
            <span v-if="p.status === 'on' && p.stock > 0" class="text-secondary">库存 {{ p.stock }} 件</span>
            <span v-else-if="p.status === 'on'" style="color: var(--el-color-danger)">已售罄</span>
            <span v-else class="text-secondary">未上架</span>
            <span v-if="p.restockAt" class="text-secondary" style="font-size: 11px">最近补货 {{ formatDateTime(p.restockAt).slice(0, 10) }}</span>
          </div>
        </div>
        <div class="product-actions">
          <el-button size="small" :icon="RefreshRight" @click="openRestock(p)">补货</el-button>
          <el-button size="small" :icon="Edit" @click="openEdit(p)">编辑</el-button>
          <el-button size="small" :type="p.status === 'on' ? 'warning' : 'success'" plain @click="toggleStatus(p)">
            {{ p.status === 'on' ? '下架' : '上架' }}
          </el-button>
          <el-button size="small" type="danger" plain :icon="Delete" @click="removeProduct(p)">删除</el-button>
        </div>
      </div>
    </div>

    <div v-else class="glass-card empty-state">
      <el-icon class="empty-icon"><ShoppingCart /></el-icon>
      <div style="font-size: 16px; font-weight: 600">{{ keyword || categoryFilter || statusFilter ? '没有匹配的商品' : '积分商店还没有商品' }}</div>
      <div class="text-secondary">上架商品后，学生就可以用积分兑换啦</div>
      <el-button type="primary" :icon="Plus" @click="openAdd">新增商品</el-button>
    </div>

    <!-- 新增 / 编辑商品对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑商品' : '新增商品'" width="560px" :close-on-click-modal="false">
      <el-form label-width="90px">
        <el-form-item label="商品名称" required>
          <el-input v-model="form.name" placeholder="如：免作业券" maxlength="30" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="form.category" placeholder="如：学习用品 / 特权（可自定义）" maxlength="20" />
        </el-form-item>
        <el-form-item label="商品图片">
          <div class="flex gap12">
            <div v-if="form.image" class="img-preview">
              <img :src="form.image" alt="" />
              <el-button text type="danger" size="small" class="img-clear" @click="form.image = null">移除</el-button>
            </div>
            <el-upload :show-file-list="false" accept="image/*" :http-request="onProductImageUpload">
              <el-button :loading="uploading">上传图片</el-button>
            </el-upload>
            <span class="text-secondary" style="font-size: 12px">可选，自动压缩</span>
          </div>
        </el-form-item>
        <el-form-item label="商品描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="商品简介（可选）" maxlength="200" />
        </el-form-item>
        <el-form-item label="原价">
          <el-input-number v-model="form.originalPrice" :min="1" :max="99999" />
          <span class="text-secondary" style="margin-left: 8px">分（必须为大于 0 的整数）</span>
        </el-form-item>
        <el-form-item label="折扣">
          <el-slider v-model="form.discount" :min="1" :max="100" :marks="{ 50: '5折', 100: '无折扣' }" style="width: 300px" />
          <span class="text-secondary" style="margin-left: 10px">当前 {{ form.discount }} 折</span>
        </el-form-item>
        <el-form-item label="实际价格">
          <b style="color: var(--el-color-danger); font-size: 18px">{{ formActualPrice }}</b>
          <span class="text-secondary" style="margin-left: 8px">分</span>
        </el-form-item>
        <el-form-item label="库存">
          <el-input-number v-model="form.stock" :min="0" :max="99999" />
          <span class="text-secondary" style="margin-left: 8px">件</span>
        </el-form-item>
        <el-form-item label="立即上架">
          <el-switch v-model="form.onSale" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProduct">保存</el-button>
      </template>
    </el-dialog>

    <!-- 补货对话框 -->
    <el-dialog v-model="restockVisible" title="商品补货" width="420px" :close-on-click-modal="false">
      <template v-if="restockProduct">
        <div class="restock-info">
          <div class="restock-name">{{ restockProduct.name }}</div>
          <div class="text-secondary" style="font-size: 13px">当前库存 <b>{{ restockProduct.stock }}</b> 件</div>
        </div>
        <div class="flex gap12 items-center mt16">
          <span>补货数量</span>
          <el-input-number v-model="restockQty" :min="1" :max="99999" />
        </div>
        <div class="restock-after">补货后库存：<b>{{ restockAfter }}</b> 件</div>
      </template>
      <template #footer>
        <el-button @click="restockVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRestock">确认补货</el-button>
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

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}
.product-card {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.product-img {
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(127, 146, 173, 0.1);
  color: var(--app-text-secondary);
  position: relative;
  overflow: hidden;
}
.product-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.off-tag,
.soldout-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 20px;
  color: #fff;
}
.off-tag {
  background: rgba(100, 116, 139, 0.85);
}
.soldout-tag {
  background: rgba(244, 63, 94, 0.9);
}
.product-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.product-name {
  font-weight: 700;
  font-size: 15px;
}
.price-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.price-now {
  color: var(--el-color-danger);
  font-weight: 800;
  font-size: 16px;
}
.price-old {
  color: var(--app-text-secondary);
  font-size: 12px;
  text-decoration: line-through;
}
.stock-row {
  font-size: 12px;
  display: flex;
  justify-content: space-between;
}
.product-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 14px 14px;
}
.product-actions :deep(.el-button) {
  margin: 0;
}

.restock-info {
  background: rgba(127, 146, 173, 0.1);
  border-radius: 10px;
  padding: 12px 14px;
}
.restock-name {
  font-weight: 700;
  margin-bottom: 4px;
}
.restock-after {
  margin-top: 12px;
  background: rgba(96, 165, 250, 0.12);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
}
.img-preview {
  position: relative;
  width: 90px;
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
.items-center {
  align-items: center;
}
</style>
