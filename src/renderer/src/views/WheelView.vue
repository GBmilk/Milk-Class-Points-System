<script setup lang="ts">
// 幸运大转盘：页面默认只展示转盘，学生 / 消耗 / 奖项等配置放在「抽奖设置」抽屉中
import { computed, onMounted, ref } from 'vue'
import { Setting, RefreshRight } from '@element-plus/icons-vue'
import WheelSettingsDrawer from '../components/WheelSettingsDrawer.vue'
import { useWheel, WHEEL_SIZE, SPIN_DURATION } from '../composables/useWheel'

const {
  wheelSegments,
  segments,
  rotation,
  spinning,
  spin,
  selectedStudent,
  spinCost,
  lastResult,
  resultVisible,
  syncProductAwards,
  studentId,
  enabledStudents,
  affordable
} = useWheel()

const settingsVisible = ref(false)

// 每次进入转盘页都同步一次商品奖项，保证转盘与积分商店保持一致
onMounted(syncProductAwards)

/** 抽奖消耗提示：付费抽奖时提示将扣多少分，积分不足时给出明确提醒 */
const costTip = computed(() => {
  if (!selectedStudent.value || spinCost.value <= 0) return ''
  return affordable.value
    ? `本次抽奖将扣除 ${spinCost.value} 分`
    : `积分不足：本次抽奖需要 ${spinCost.value} 分`
})

/** 转盘旋转样式（只作用于圆盘本身，中间的按钮不参与旋转） */
const rotationStyle = computed(() => ({
  transform: `rotate(${rotation.value}deg)`,
  transition: spinning.value ? `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : 'none'
}))
</script>

<template>
  <div class="page wheel-page">
    <div class="glass-card wheel-stage">
      <div class="stage-bar">
        <div class="stage-chips">
          <el-tag round effect="plain" :type="selectedStudent ? 'primary' : 'info'">
            {{ selectedStudent ? `参与学生：${selectedStudent.name}（${selectedStudent.points} 分）` : '未选择参与学生' }}
          </el-tag>
          <el-tag round effect="plain" :type="spinCost > 0 ? 'warning' : 'success'">
            {{ spinCost > 0 ? `每次消耗 ${spinCost} 分` : '免费抽奖' }}
          </el-tag>
          <el-tag round effect="plain" type="info">{{ segments.length }} 个奖项</el-tag>
        </div>
        <el-button :icon="Setting" @click="settingsVisible = true">抽奖设置</el-button>
      </div>

      <div class="wheel-area">
        <div class="wheel-wrap">
          <div class="pointer"></div>
          <div class="wheel" :style="rotationStyle">
            <svg :width="WHEEL_SIZE" :height="WHEEL_SIZE" :viewBox="`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`">
              <circle
                :cx="WHEEL_SIZE / 2"
                :cy="WHEEL_SIZE / 2"
                :r="WHEEL_SIZE / 2 - 2"
                fill="#ffffff"
                opacity="0.08"
              />
              <path
                v-for="seg in wheelSegments"
                :key="seg.key"
                :d="seg.path"
                :fill="seg.color"
                stroke="#fff"
                stroke-width="1.5"
              />
              <text
                v-for="seg in wheelSegments"
                :key="`label:${seg.key}`"
                :x="seg.labelX"
                :y="seg.labelY"
                fill="#fff"
                font-size="14"
                font-weight="700"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {{ seg.name }}
              </text>
            </svg>
            <div v-if="wheelSegments.length === 0" class="wheel-empty">
              还没有可用的奖项<br />请先在「抽奖设置」中添加
            </div>
          </div>
          <!-- 开始按钮独立于转盘之外，抽奖时不会跟着旋转 -->
          <div class="wheel-center" :class="{ spinning }" @click="spin">
            <RefreshRight v-if="spinning" class="spin-icon" />
            <span>{{ spinning ? '抽奖中' : '开始' }}</span>
          </div>
        </div>
        <div class="wheel-hint">
          {{ spinning ? '转盘正在旋转，请稍候…' : '点击中间按钮开始抽奖，指针所指的奖项即为中奖结果' }}
        </div>
      </div>

      <!-- 参与抽奖的学生：直接放在转盘下方，方便课堂上快速切换 -->
      <div class="student-picker">
        <div class="picker-head">
          <span class="picker-title">参与抽奖的学生</span>
          <span v-if="selectedStudent" class="picker-points">
            当前积分 <b>{{ selectedStudent.points }}</b> 分
          </span>
          <span v-else class="picker-points text-secondary">尚未选择学生</span>
        </div>
        <el-select v-model="studentId" filterable placeholder="搜索并选择学生" class="picker-select">
          <el-option
            v-for="stu in enabledStudents"
            :key="stu.id"
            :label="`${stu.name}（${stu.points} 分）`"
            :value="stu.id"
          />
        </el-select>
        <div v-if="enabledStudents.length" class="picker-chips">
          <button
            v-for="stu in enabledStudents"
            :key="stu.id"
            type="button"
            class="stu-chip"
            :class="{ active: stu.id === studentId }"
            @click="studentId = stu.id"
          >
            <span class="chip-name">{{ stu.name }}</span>
            <span class="chip-pts">{{ stu.points }}</span>
          </button>
        </div>
        <div v-else class="picker-empty">还没有学生，请先到「学生管理」添加学生</div>
        <div v-if="costTip" class="picker-warn">{{ costTip }}</div>
      </div>
    </div>

    <!-- 抽奖设置：免费/付费、奖项与权重（参与学生已移到转盘下方） -->
    <WheelSettingsDrawer v-model="settingsVisible" />

    <!-- 中奖结果 -->
    <el-dialog v-model="resultVisible" title="🎉 抽奖结果" width="400px" :close-on-click-modal="false">
      <div v-if="lastResult" class="result-box">
        <div class="result-emoji">{{ lastResult.source === 'product' ? '🎁' : '🌟' }}</div>
        <div class="result-student">恭喜 {{ lastResult.studentName }}</div>
        <div class="result-award">中奖：{{ lastResult.awardName }}</div>
        <div class="result-sub">
          {{ lastResult.cost > 0 ? `已扣除 ${lastResult.cost} 分抽奖费用` : '本次为免费抽奖，未扣除积分' }}
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="resultVisible = false">开心收下</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.wheel-page {
  display: flex;
  /* .page 本身是纵向 flex：这里用 align-items 做水平居中，让转盘卡片真正位于内容区中间 */
  align-items: center;
  /* safe center：空间足够时垂直居中，内容超高时自动从顶部开始，避免滚动时顶部被裁掉 */
  justify-content: safe center;
}
.wheel-stage {
  width: 100%;
  max-width: 760px;
  padding: 16px 22px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.stage-bar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.stage-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.wheel-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.wheel-wrap {
  position: relative;
  width: 420px;
  height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pointer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  width: 0;
  height: 0;
  border-left: 16px solid transparent;
  border-right: 16px solid transparent;
  border-top: 30px solid var(--el-color-danger);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}
.wheel {
  width: 380px;
  height: 380px;
  border-radius: 50%;
  position: relative;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  border: 8px solid #fff;
  flex-shrink: 0;
}
html.dark .wheel {
  border-color: #1c2438;
}
.wheel svg {
  display: block;
  width: 100%;
  height: 100%;
}
.wheel-empty {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  /* 行向容器：align-items 控制纵向，把提示文字压到转盘下半部分，避免与中间按钮重叠 */
  align-items: flex-end;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  line-height: 1.8;
  color: var(--app-text-secondary);
  background: rgba(255, 255, 255, 0.72);
  padding: 0 70px 54px;
}
html.dark .wheel-empty {
  background: rgba(20, 26, 40, 0.72);
}
.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 94px;
  height: 94px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28), 0 0 0 5px rgba(255, 255, 255, 0.85);
  transition: transform 0.15s ease;
  z-index: 5;
}
.wheel-center:hover {
  transform: translate(-50%, -50%) scale(1.05);
}
.wheel-center:active {
  transform: translate(-50%, -50%) scale(0.95);
}
.wheel-center.spinning {
  cursor: not-allowed;
}
.spin-icon {
  animation: wheel-icon-spin 1s linear infinite;
}
@keyframes wheel-icon-spin {
  to {
    transform: rotate(360deg);
  }
}
.wheel-hint {
  font-size: 13px;
  color: var(--app-text-secondary);
}
/* 参与抽奖的学生选择区（转盘下方） */
.student-picker {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(127, 146, 173, 0.08);
  border: 1px solid var(--app-card-border);
}
.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.picker-title {
  font-size: 14px;
  font-weight: 700;
}
.picker-points {
  font-size: 13px;
}
.picker-select {
  width: 100%;
}
.picker-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 136px;
  overflow-y: auto;
  padding-right: 4px;
}
.stu-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid var(--app-card-border);
  background: var(--app-card-bg);
  color: var(--app-text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}
.stu-chip:hover {
  border-color: var(--app-primary);
  transform: translateY(-1px);
}
.stu-chip.active {
  background: linear-gradient(135deg, var(--app-grad-a), var(--app-grad-b));
  border-color: transparent;
  color: #fff;
}
.stu-chip .chip-pts {
  font-size: 12px;
  opacity: 0.75;
}
.picker-empty {
  font-size: 13px;
  color: var(--app-text-secondary);
}
.picker-warn {
  font-size: 12px;
  color: var(--el-color-warning);
}
.result-box {
  text-align: center;
  padding: 10px 0;
}
.result-emoji {
  font-size: 64px;
  margin-bottom: 10px;
}
.result-student {
  font-size: 17px;
  font-weight: 700;
}
.result-award {
  font-size: 24px;
  font-weight: 800;
  color: var(--el-color-warning);
  margin-top: 8px;
}
.result-sub {
  margin-top: 10px;
  font-size: 13px;
  color: var(--app-text-secondary);
}

/* 小窗口（1280×720 / 1366×768）下整体缩小，保证转盘与学生选择区都能完整显示 */
@media (max-height: 860px) {
  .wheel-wrap {
    width: 360px;
    height: 360px;
  }
  .wheel {
    width: 320px;
    height: 320px;
    border-width: 6px;
  }
  .wheel-center {
    width: 80px;
    height: 80px;
    font-size: 15px;
  }
  .wheel-empty {
    padding: 0 58px 44px;
  }
  .picker-chips {
    max-height: 104px;
  }
}

/* 1280×720 等较矮窗口：进一步压缩，保证转盘与学生选择区无需滚动即可完整显示 */
@media (max-height: 780px) {
  .wheel-stage {
    padding: 12px 18px 16px;
    gap: 10px;
  }
  .wheel-wrap {
    width: 296px;
    height: 296px;
  }
  .wheel {
    width: 264px;
    height: 264px;
    border-width: 5px;
  }
  .wheel-center {
    width: 66px;
    height: 66px;
    font-size: 14px;
    box-shadow: 0 5px 14px rgba(0, 0, 0, 0.26), 0 0 0 4px rgba(255, 255, 255, 0.85);
  }
  .wheel-empty {
    padding: 0 44px 30px;
    font-size: 12px;
  }
  .student-picker {
    padding: 10px 12px;
    gap: 8px;
  }
  .picker-chips {
    max-height: 74px;
  }
}
</style>
