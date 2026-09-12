// ===== 幸运大转盘逻辑 =====
// 转盘页与「抽奖设置」抽屉需要共享同一份状态，因此这里使用懒加载单例：
// 首次调用时创建（此时 Pinia 已安装），之后复用同一实例。
import { computed, effectScope, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useDataStore } from '../stores/data'

/** 转盘奖项 */
export interface WheelAward {
  key: string
  name: string
  /** 中奖权重（0 表示不会中奖，也不显示在转盘上） */
  weight: number
  source: 'product' | 'custom'
  productId: string | null
  /** 中奖后是否扣减 1 件库存（仅商品奖项有效） */
  deductStock: boolean
}

/** 一次抽奖的中奖结果 */
export interface WheelResult {
  studentName: string
  awardName: string
  source: 'product' | 'custom'
  cost: number
}

/** 转盘画布尺寸（与 SVG viewBox 保持一致） */
export const WHEEL_SIZE = 380
/** 旋转动画时长（毫秒） */
export const SPIN_DURATION = 4200
/** 扇形配色 */
const SEGMENT_COLORS = [
  '#f87171',
  '#fbbf24',
  '#34d399',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
  '#38bdf8',
  '#fb923c',
  '#4ade80',
  '#e879f9',
  '#22d3ee',
  '#a3e635'
]

function createWheel() {
  const data = useDataStore()
  const s = () => data.state

  // ===== 奖项配置 =====
  const customAwards = ref<WheelAward[]>(
    s().settings.wheelCustomAwards.map((a) => ({
      key: a.id,
      name: a.name,
      weight: a.weight,
      source: 'custom' as const,
      productId: null,
      deductStock: false
    }))
  )
  const awards = ref<WheelAward[]>([])

  // 商品奖项的权重 / 扣库存设置改动后自动持久化
  watch(
    awards,
    () => {
      const next: Record<string, { weight: number; deductStock: boolean }> = {}
      for (const a of awards.value) {
        if (a.source === 'product' && a.productId) {
          next[a.productId] = {
            weight: Math.max(0, Math.floor(Number(a.weight) || 0)),
            deductStock: a.deductStock
          }
        }
      }
      data.updateSettings({ wheelProductAwards: next })
    },
    { deep: true }
  )

  /** 从当前上架商品同步商品奖项（保留已配置的权重与扣库存设置），并追加自定义奖项 */
  function syncProductAwards(): void {
    const existing = new Map(
      awards.value.filter((a) => a.source === 'product' && a.productId).map((a) => [a.productId, a])
    )
    const productAwards: WheelAward[] = s()
      .products.filter((p) => p.status === 'on')
      .map((p) => {
        const prev = existing.get(p.id) ?? s().settings.wheelProductAwards[p.id]
        return {
          key: `p:${p.id}`,
          name: p.name,
          weight: prev?.weight ?? 1,
          source: 'product' as const,
          productId: p.id,
          deductStock: prev?.deductStock ?? true
        }
      })
    awards.value = [...productAwards, ...customAwards.value]
  }

  // 商品上架 / 下架 / 改名 / 补货后自动同步奖项
  watch(
    () => s().products.map((p) => `${p.id}:${p.status}:${p.name}`).join('|'),
    () => syncProductAwards()
  )

  // 自定义奖项改动后自动持久化并刷新转盘
  watch(
    customAwards,
    () => {
      data.updateSettings({
        wheelCustomAwards: customAwards.value.map((a) => ({
          id: a.key,
          name: a.name,
          weight: Math.max(0, Math.floor(Number(a.weight) || 0))
        }))
      })
      syncProductAwards()
    },
    { deep: true }
  )

  function addCustomAward(): void {
    customAwards.value.push({
      key: `c:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: `自定义奖项${customAwards.value.length + 1}`,
      weight: 1,
      source: 'custom',
      productId: null,
      deductStock: false
    })
  }

  function removeCustomAward(key: string): void {
    customAwards.value = customAwards.value.filter((a) => a.key !== key)
  }

  // ===== 参与学生与抽奖消耗 =====
  const studentId = ref('')
  const costEnabled = ref(s().settings.wheelCostEnabled)
  const costAmount = ref(s().settings.wheelCostAmount)

  watch(
    () => [costEnabled.value, costAmount.value] as const,
    ([enabled, amount]) => {
      data.updateSettings({ wheelCostEnabled: enabled, wheelCostAmount: Math.max(0, Math.floor(amount) || 0) })
    }
  )

  const selectedStudent = computed(() => data.studentById(studentId.value))
  const enabledStudents = computed(() => s().students.filter((x) => x.enabled))
  /** 本次抽奖实际消耗的积分 */
  const spinCost = computed(() => (costEnabled.value ? Math.max(0, Math.floor(costAmount.value) || 0) : 0))
  /** 当前学生是否付得起本次抽奖（免费抽奖恒为 true） */
  const affordable = computed(() => {
    const cost = spinCost.value
    if (cost <= 0) return true
    const stu = selectedStudent.value
    if (!stu) return false
    return s().settings.allowNegative || stu.points >= cost
  })

  // 数据被清空 / 重置 / 导入后，把抽屉里的本地状态重新对齐到最新设置，避免残留旧奖项
  watch(
    () => data.dataRevision,
    () => {
      customAwards.value = s().settings.wheelCustomAwards.map((a) => ({
        key: a.id,
        name: a.name,
        weight: a.weight,
        source: 'custom' as const,
        productId: null,
        deductStock: false
      }))
      costEnabled.value = s().settings.wheelCostEnabled
      costAmount.value = s().settings.wheelCostAmount
      if (studentId.value && !data.studentById(studentId.value)) studentId.value = ''
      syncProductAwards()
    }
  )

  // ===== 概率 =====
  const totalWeight = computed(() => awards.value.reduce((sum, a) => sum + Math.max(0, Number(a.weight) || 0), 0))

  function percent(a: WheelAward): string {
    if (totalWeight.value <= 0) return '0%'
    return `${((Math.max(0, Number(a.weight) || 0) / totalWeight.value) * 100).toFixed(1)}%`
  }

  // ===== 转盘几何 =====
  /** 只有权重大于 0 的奖项才会出现在转盘上 */
  const segments = computed(() => awards.value.filter((a) => Math.max(0, Number(a.weight) || 0) > 0))

  function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }

  const wheelSegments = computed(() => {
    const list = segments.value
    const n = list.length
    if (n === 0) return []
    const cx = WHEEL_SIZE / 2
    const cy = WHEEL_SIZE / 2
    const r = WHEEL_SIZE / 2 - 4
    // 只有一个奖项时用整圆渲染，避免 SVG 圆弧起止点重合导致转盘空白
    if (n === 1) {
      return [
        {
          key: list[0].key,
          path: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`,
          labelX: cx.toFixed(2),
          labelY: (cy + r * 0.62).toFixed(2),
          color: SEGMENT_COLORS[0],
          name: list[0].name.length > 6 ? `${list[0].name.slice(0, 6)}…` : list[0].name
        }
      ]
    }
    const each = 360 / n
    return list.map((seg, i) => {
      const a0 = i * each
      const a1 = (i + 1) * each
      const [x0, y0] = polar(cx, cy, r, a0)
      const [x1, y1] = polar(cx, cy, r, a1)
      const [tx, ty] = polar(cx, cy, r * 0.64, (a0 + a1) / 2)
      return {
        key: seg.key,
        path: `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${each > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
        labelX: tx.toFixed(2),
        labelY: ty.toFixed(2),
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        name: seg.name.length > 6 ? `${seg.name.slice(0, 6)}…` : seg.name
      }
    })
  })

  // ===== 旋转与抽奖 =====
  const rotation = ref(0)
  const spinning = ref(false)
  const lastResult = ref<WheelResult | null>(null)
  const resultVisible = ref(false)

  /** 参与抽奖的奖项池：自动排除扣库存但已缺货的商品奖项 */
  function spinPool(): WheelAward[] {
    return segments.value.filter(
      (a) => !(a.source === 'product' && a.deductStock && (data.productById(a.productId)?.stock ?? 0) <= 0)
    )
  }

  function spin(): void {
    if (spinning.value) return
    const student = selectedStudent.value
    if (!student) {
      ElMessage.warning('请先在「抽奖设置」中选择参与抽奖的学生')
      return
    }
    if (segments.value.length === 0) {
      ElMessage.warning('请先在「抽奖设置」中配置奖项权重')
      return
    }
    const pool = spinPool()
    if (pool.length === 0) {
      ElMessage.warning('所有商品奖项均已缺货，请先补货或添加自定义奖项')
      return
    }
    const cost = spinCost.value
    if (cost > 0 && !s().settings.allowNegative && student.points < cost) {
      ElMessage.warning(`积分不足，抽奖需要 ${cost} 分（当前 ${student.points} 分）`)
      return
    }
    // 按权重抽取中奖奖项
    const total = pool.reduce((sum, a) => sum + Math.max(0, Number(a.weight) || 0), 0)
    if (total <= 0) {
      ElMessage.warning('奖项权重之和必须大于 0')
      return
    }
    let random = Math.random() * total
    let winner = pool[0]
    for (const a of pool) {
      random -= Math.max(0, Number(a.weight) || 0)
      if (random <= 0) {
        winner = a
        break
      }
    }
    // 计算指针停留角度：让中奖扇形的中心对准顶部指针
    const each = 360 / pool.length
    const index = pool.indexOf(winner)
    const target = (360 - (index + 0.5) * each + 360) % 360
    const current = ((rotation.value % 360) + 360) % 360
    const delta = (target - current + 360) % 360
    spinning.value = true
    rotation.value += 360 * 6 + delta

    window.setTimeout(() => {
      spinning.value = false
      // 动画结束后统一结算：扣积分、扣库存、写记录，任一失败都不落地
      const res = data.settleLottery({
        studentId: student.id,
        awardName: winner.name,
        cost,
        productId: winner.productId,
        deductStock: winner.source === 'product' && winner.deductStock
      })
      if (!res.ok) {
        ElMessage.error(res.message ?? '抽奖结算失败')
        return
      }
      lastResult.value = {
        studentName: student.name,
        awardName: winner.name,
        source: winner.source,
        cost
      }
      resultVisible.value = true
    }, SPIN_DURATION)
  }

  // 初始化时同步一次商品奖项，保证转盘与商店一致
  syncProductAwards()

  return {
    awards,
    customAwards,
    addCustomAward,
    removeCustomAward,
    syncProductAwards,
    studentId,
    selectedStudent,
    enabledStudents,
    costEnabled,
    costAmount,
    spinCost,
    affordable,
    totalWeight,
    percent,
    segments,
    wheelSegments,
    rotation,
    spinning,
    spin,
    lastResult,
    resultVisible
  }
}

let wheelInstance: ReturnType<typeof createWheel> | null = null
// 游离的 effectScope：转盘是全应用共享的单例，内部 watch 不能随某个组件的卸载而被销毁
const wheelScope = effectScope(true)

/** 获取转盘状态（全应用共享同一实例） */
export function useWheel(): ReturnType<typeof createWheel> {
  if (!wheelInstance) {
    wheelInstance = wheelScope.run(() => createWheel()) as ReturnType<typeof createWheel>
  }
  return wheelInstance
}
