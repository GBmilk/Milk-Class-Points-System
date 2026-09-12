<script setup lang="ts">
// 抽奖设置抽屉：免费/付费、奖项与中奖权重（参与学生在转盘页下方单独选择）
import { Plus, Delete } from '@element-plus/icons-vue'
import { useWheel } from '../composables/useWheel'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const {
  awards,
  costEnabled,
  costAmount,
  percent,
  totalWeight,
  addCustomAward,
  removeCustomAward
} = useWheel()
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="🎡 抽奖设置"
    size="480px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="wheel-settings">
      <div class="config-tip">参与抽奖的学生请在转盘下方的「参与抽奖的学生」区域选择。</div>
      <div class="config-section">
        <div class="config-title">抽奖消耗</div>
        <div class="flex gap8 items-center flex-wrap">
          <el-switch v-model="costEnabled" active-text="消耗积分" inactive-text="免费抽奖" />
          <template v-if="costEnabled">
            <span class="text-secondary">每次消耗</span>
            <el-input-number v-model="costAmount" :min="1" :max="9999" size="small" style="width: 110px" />
            <span class="text-secondary">分</span>
          </template>
        </div>
        <div class="text-secondary" style="font-size: 12px; margin-top: 6px">
          {{ costEnabled ? '学生每次抽奖前会校验积分是否充足' : '不扣除任何积分，所有学生都可参与' }}
        </div>
      </div>

      <div class="config-section">
        <div class="config-title flex-between">
          <span>奖项与中奖概率（{{ totalWeight > 0 ? '按权重计算' : '未配置' }}）</span>
          <el-button size="small" :icon="Plus" @click="addCustomAward">自定义奖项</el-button>
        </div>

        <div v-if="awards.length" class="award-list">
          <div v-for="a in awards" :key="a.key" class="award-row">
            <el-tag size="small" :type="a.source === 'product' ? 'primary' : 'success'" effect="plain">
              {{ a.source === 'product' ? '商品' : '自定义' }}
            </el-tag>
            <el-input
              v-if="a.source === 'custom'"
              v-model="a.name"
              size="small"
              placeholder="输入奖项名称"
              class="award-name-input"
              maxlength="20"
            />
            <span v-else class="award-name ellipsis" :title="a.name">{{ a.name }}</span>
            <el-tooltip v-if="a.source === 'product'" content="中奖后扣除 1 件库存">
              <el-checkbox v-model="a.deductStock" size="small">扣库存</el-checkbox>
            </el-tooltip>
            <el-input-number v-model="a.weight" :min="0" :max="9999" size="small" style="width: 92px" />
            <span class="award-percent">{{ percent(a) }}</span>
            <el-button
              v-if="a.source === 'custom'"
              text
              type="danger"
              size="small"
              :icon="Delete"
              @click="removeCustomAward(a.key)"
            />
          </div>
        </div>
        <div v-else class="empty-tip">暂无奖项，请先上架商品或添加自定义奖项</div>

        <div class="text-secondary" style="font-size: 12px; margin-top: 8px">
          商品奖项自动来自「上架中」的商品；权重为 0 的奖项不会出现在转盘上；缺货商品在抽奖前会被自动排除。
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.wheel-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.config-section {
  background: rgba(127, 146, 173, 0.07);
  border-radius: 12px;
  padding: 12px 14px;
}
.config-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
}
.config-tip {
  font-size: 12px;
  color: var(--app-text-secondary);
  background: rgba(127, 146, 173, 0.07);
  border-radius: 10px;
  padding: 8px 12px;
}
.items-center {
  align-items: center;
}
.award-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.award-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--app-card-bg);
  border-radius: 8px;
  border: 1px solid var(--app-card-border);
}
.award-name-input {
  flex: 1;
  min-width: 90px;
}
.award-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}
.award-percent {
  font-size: 12px;
  color: var(--app-text-secondary);
  min-width: 46px;
  text-align: right;
}
.empty-tip {
  text-align: center;
  color: var(--app-text-secondary);
  font-size: 13px;
  padding: 14px 0;
}
</style>
