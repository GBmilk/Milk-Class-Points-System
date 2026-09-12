// ===== 全局数据仓库：本地持久化 + 业务操作 =====
import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'
import type {
  DataState,
  Gender,
  Group,
  Honor,
  OperatorType,
  PasswordHash,
  PointsRecord,
  Product,
  ProductStatus,
  Student,
  SystemSettings
} from '../types'
import { dbGet, dbSet } from '../utils/db'
import { createPasswordHash } from '../utils/crypto'
import { DEFAULT_PASSWORD } from '../utils/defaults'
import { createEmptyData, DATA_VERSION, createDefaultSettings } from '../utils/defaults'
import { genId } from '../utils/format'
import { pinyinFull } from '../utils/pinyin'

const DATA_KEY = 'milk-class-points:data'

export interface StudentInput {
  name: string
  gender: Gender
  className: string
  points: number
  groupId: string | null
  avatar: string | null
}

export interface GroupInput {
  name: string
  initial: string
  color: string
  icon: string | null
  leaderId: string | null
}

export interface ProductInput {
  name: string
  image: string | null
  description: string
  originalPrice: number
  discount: number
  stock: number
  category: string
  status: ProductStatus
}

export interface HonorInput {
  name: string
  image: string | null
  awardedAt: string
  description: string
}

interface AddPointsOptions {
  studentIds: string[]
  score: number
  reason: string
  operatorType: OperatorType
  note?: string
}

/** 幸运大转盘结算参数 */
export interface LotterySettleInput {
  studentId: string
  /** 中奖奖项名称 */
  awardName: string
  /** 本次抽奖消耗的积分（0 表示免费） */
  cost: number
  /** 中奖奖品对应的商品（自定义奖项为 null） */
  productId: string | null
  /** 中奖后是否扣减 1 件库存 */
  deductStock: boolean
}

interface OpResult {
  ok: boolean
  message?: string
  count?: number
}

export const useDataStore = defineStore('data', () => {
  const state = reactive<DataState>(createEmptyData())
  let loaded = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  // 数据被整体替换（清空 / 重置 / 导入）时自增，供页面级状态重新对齐
  const dataRevision = ref(0)

  // ===== 持久化（防抖） =====
  /** 将响应式状态转为普通对象，避免 IndexedDB 结构化克隆失败（Vue Proxy 无法克隆） */
  function snapshot(): DataState {
    return JSON.parse(JSON.stringify(state)) as DataState
  }

  function persist(): void {
    if (!loaded) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      dbSet(DATA_KEY, snapshot()).catch((e) => console.error('保存数据失败', e))
    }, 200)
  }
  watch(state, () => persist(), { deep: true })

  // ===== 数据规范化：兼容旧数据 / 缺字段 =====
  function normalize(raw: unknown): DataState {
    const base = createEmptyData()
    if (!raw || typeof raw !== 'object') return base
    const r = raw as Record<string, unknown>
    const out: DataState = {
      version: typeof r.version === 'number' ? r.version : DATA_VERSION,
      settings: { ...base.settings, ...((r.settings as object) ?? {}) },
      students: Array.isArray(r.students) ? (r.students as Student[]) : [],
      records: Array.isArray(r.records) ? (r.records as PointsRecord[]) : [],
      products: Array.isArray(r.products) ? (r.products as Product[]) : [],
      groups: Array.isArray(r.groups) ? (r.groups as Group[]) : [],
      honors: Array.isArray(r.honors) ? (r.honors as Honor[]) : []
    }
    // 补充缺失字段
    out.students = out.students.map((s) => ({
      id: s.id ?? genId(),
      name: s.name ?? '未命名',
      gender: s.gender === 'female' ? 'female' : 'male',
      className: s.className ?? '',
      points: Number.isFinite(s.points) ? s.points : 0,
      groupId: s.groupId ?? null,
      avatar: s.avatar ?? null,
      enabled: s.enabled !== false,
      createdAt: s.createdAt ?? new Date().toISOString(),
      updatedAt: s.updatedAt ?? s.createdAt ?? new Date().toISOString()
    }))
    out.products = out.products.map((p) => ({
      id: p.id ?? genId(),
      name: p.name ?? '未命名商品',
      image: p.image ?? null,
      description: p.description ?? '',
      originalPrice: Number.isFinite(p.originalPrice) ? p.originalPrice : 0,
      discount: Number.isFinite(p.discount) && p.discount > 0 ? p.discount : 100,
      stock: Number.isFinite(p.stock) ? Math.max(0, Math.floor(p.stock)) : 0,
      status: p.status === 'deleted' ? 'deleted' : p.status === 'off' ? 'off' : 'on',
      category: p.category ?? '',
      createdAt: p.createdAt ?? new Date().toISOString(),
      updatedAt: p.updatedAt ?? p.createdAt ?? new Date().toISOString(),
      restockAt: p.restockAt ?? null
    }))
    out.groups = out.groups.map((g) => ({
      id: g.id ?? genId(),
      name: g.name ?? '未命名小组',
      initial: g.initial ?? '',
      color: g.color ?? '#3b82f6',
      icon: g.icon ?? null,
      leaderId: g.leaderId ?? null,
      createdAt: g.createdAt ?? new Date().toISOString()
    }))
    out.honors = out.honors.map((h) => ({
      id: h.id ?? genId(),
      name: h.name ?? '未命名荣誉',
      image: h.image ?? null,
      awardedAt: h.awardedAt ?? new Date().toISOString(),
      description: h.description ?? '',
      createdAt: h.createdAt ?? new Date().toISOString()
    }))
    // 小组组员同步：确保 groupId 有效
    const groupIds = new Set(out.groups.map((g) => g.id))
    out.students.forEach((s) => {
      if (s.groupId && !groupIds.has(s.groupId)) s.groupId = null
    })
    return out
  }

  // ===== 初始化 =====
  async function init(): Promise<void> {
    try {
      const raw = await dbGet<DataState>(DATA_KEY)
      Object.assign(state, normalize(raw))
    } catch (e) {
      console.error('读取本地数据失败，使用空数据', e)
    }
    // 首次运行：初始化默认密码（仅内部处理，不在界面显示）
    if (!state.settings.passwordHash) {
      try {
        state.settings.passwordHash = await createPasswordHash(DEFAULT_PASSWORD, 'SHA-256')
      } catch (e) {
        console.error('初始化默认密码失败', e)
      }
    }
    loaded = true
  }

  // ===== 立即保存（导入导出前调用） =====
  function flush(): Promise<void> {
    return dbSet(DATA_KEY, snapshot())
  }

  // ===== 设置 =====
  function updateSettings(patch: Partial<SystemSettings>): void {
    state.settings = { ...state.settings, ...patch, updatedAt: new Date().toISOString() }
  }

  function setPasswordHash(hash: PasswordHash | null): void {
    state.settings.passwordHash = hash
    state.settings.updatedAt = new Date().toISOString()
  }

  // ===== 学生 =====
  function addStudent(input: StudentInput): Student {
    const now = new Date().toISOString()
    const s: Student = {
      id: genId(),
      name: input.name.trim(),
      gender: input.gender,
      className: input.className.trim(),
      points: Math.max(0, Math.floor(input.points)),
      groupId: input.groupId,
      avatar: input.avatar,
      enabled: true,
      createdAt: now,
      updatedAt: now
    }
    state.students.push(s)
    return s
  }

  function updateStudent(id: string, patch: Partial<Omit<Student, 'id' | 'createdAt'>>): void {
    const s = state.students.find((x) => x.id === id)
    if (!s) return
    Object.assign(s, patch, { updatedAt: new Date().toISOString() })
  }

  function removeStudents(ids: string[]): void {
    const set = new Set(ids)
    state.students = state.students.filter((s) => !set.has(s.id))
  }

  function toggleStudentEnabled(id: string): void {
    const s = state.students.find((x) => x.id === id)
    if (s) {
      s.enabled = !s.enabled
      s.updatedAt = new Date().toISOString()
    }
  }

  // ===== 小组 =====
  function addGroup(input: GroupInput): Group {
    const g: Group = {
      id: genId(),
      name: input.name.trim(),
      initial: input.initial.trim() || input.name.trim().charAt(0).toUpperCase(),
      color: input.color,
      icon: input.icon,
      leaderId: input.leaderId,
      createdAt: new Date().toISOString()
    }
    state.groups.push(g)
    return g
  }

  function updateGroup(id: string, patch: Partial<Omit<Group, 'id' | 'createdAt'>>): void {
    const g = state.groups.find((x) => x.id === id)
    if (!g) return
    Object.assign(g, patch)
  }

  function removeGroup(id: string): void {
    // 组员变为未分组，学生数据不丢失
    state.students.forEach((s) => {
      if (s.groupId === id) s.groupId = null
    })
    state.groups = state.groups.filter((g) => g.id !== id)
  }

  function setStudentGroup(studentIds: string[], groupId: string | null): void {
    const set = new Set(studentIds)
    state.students.forEach((s) => {
      if (set.has(s.id)) {
        s.groupId = groupId
        s.updatedAt = new Date().toISOString()
      }
    })
  }

  // ===== 商品 =====
  function clampDiscount(d: number): number {
    return Math.min(100, Math.max(1, Math.floor(d)))
  }

  function addProduct(input: ProductInput): Product {
    const now = new Date().toISOString()
    const p: Product = {
      id: genId(),
      name: input.name.trim(),
      image: input.image,
      description: input.description.trim(),
      originalPrice: Math.max(0, Math.floor(input.originalPrice)),
      discount: clampDiscount(input.discount),
      stock: Math.max(0, Math.floor(input.stock)),
      status: input.status,
      category: input.category.trim(),
      createdAt: now,
      updatedAt: now,
      restockAt: null
    }
    state.products.push(p)
    return p
  }

  function updateProduct(id: string, patch: Partial<Omit<Product, 'id' | 'createdAt'>>): void {
    const p = state.products.find((x) => x.id === id)
    if (!p) return
    if (patch.originalPrice !== undefined) patch.originalPrice = Math.max(0, Math.floor(patch.originalPrice))
    if (patch.discount !== undefined) patch.discount = clampDiscount(patch.discount)
    if (patch.stock !== undefined) patch.stock = Math.max(0, Math.floor(patch.stock))
    Object.assign(p, patch, { updatedAt: new Date().toISOString() })
  }

  function removeProduct(id: string, hard: boolean): void {
    if (hard) {
      state.products = state.products.filter((p) => p.id !== id)
    } else {
      const p = state.products.find((x) => x.id === id)
      if (p) {
        p.status = 'off'
        p.updatedAt = new Date().toISOString()
      }
    }
  }

  function restockProduct(id: string, qty: number): void {
    const p = state.products.find((x) => x.id === id)
    if (!p) return
    p.stock += Math.max(0, Math.floor(qty))
    p.restockAt = new Date().toISOString()
    p.updatedAt = new Date().toISOString()
  }

  function toggleProductStatus(id: string): void {
    const p = state.products.find((x) => x.id === id)
    if (!p) return
    p.status = p.status === 'on' ? 'off' : 'on'
    p.updatedAt = new Date().toISOString()
  }

  // ===== 荣誉 =====
  function addHonor(input: HonorInput): Honor {
    const h: Honor = {
      id: genId(),
      name: input.name.trim(),
      image: input.image,
      awardedAt: input.awardedAt,
      description: input.description.trim(),
      createdAt: new Date().toISOString()
    }
    state.honors.push(h)
    return h
  }

  function updateHonor(id: string, patch: Partial<Omit<Honor, 'id' | 'createdAt'>>): void {
    const h = state.honors.find((x) => x.id === id)
    if (!h) return
    Object.assign(h, patch)
  }

  function removeHonor(id: string): void {
    state.honors = state.honors.filter((h) => h.id !== id)
  }

  // ===== 积分运算 =====
  function addPoints(opts: AddPointsOptions): OpResult {
    if (opts.studentIds.length === 0) return { ok: false, message: '请至少选择一个学生' }
    if (!Number.isInteger(opts.score) || opts.score <= 0) return { ok: false, message: '加分分数必须是正整数' }
    const reason = (opts.reason || '').trim()
    if (!reason) return { ok: false, message: '请填写加分原因' }
    const now = new Date().toISOString()
    let count = 0
    for (const id of opts.studentIds) {
      const s = state.students.find((x) => x.id === id)
      if (!s) continue
      const before = s.points
      s.points += opts.score
      s.updatedAt = now
      state.records.push(makeRecord(s, 'add', opts.score, reason, now, opts.operatorType, opts.note, before))
      count++
    }
    return { ok: true, count }
  }

  function deductPoints(opts: AddPointsOptions): OpResult {
    if (opts.studentIds.length === 0) return { ok: false, message: '请至少选择一个学生' }
    if (!Number.isInteger(opts.score) || opts.score <= 0) return { ok: false, message: '减分分数必须是正整数' }
    const reason = (opts.reason || '').trim()
    if (!reason) return { ok: false, message: '请填写减分原因' }
    // 预校验：不允许负分时，任何学生不够扣则整体失败，保证批量一致性
    if (!state.settings.allowNegative) {
      const blocked = opts.studentIds
        .map((id) => state.students.find((x) => x.id === id))
        .filter((s): s is Student => !!s && s.points < opts.score)
      if (blocked.length > 0) {
        const names = blocked.map((s) => s.name).slice(0, 3).join('、')
        return { ok: false, message: `积分不足，无法扣分：${names}${blocked.length > 3 ? ' 等' : ''}` }
      }
    }
    const now = new Date().toISOString()
    let count = 0
    for (const id of opts.studentIds) {
      const s = state.students.find((x) => x.id === id)
      if (!s) continue
      const before = s.points
      s.points -= opts.score
      s.updatedAt = now
      state.records.push(makeRecord(s, 'deduct', -opts.score, reason, now, opts.operatorType, opts.note, before))
      count++
    }
    return { ok: true, count }
  }

  function makeRecord(
    s: Student,
    type: PointsRecord['type'],
    score: number,
    reason: string,
    time: string,
    operatorType: OperatorType,
    note: string | undefined,
    before: number
  ): PointsRecord {
    return {
      id: genId(),
      studentId: s.id,
      groupId: s.groupId,
      type,
      score,
      reason,
      time,
      operatorType,
      note: note ?? '',
      productId: null,
      productName: null,
      beforePoints: before,
      afterPoints: s.points
    }
  }

  /** 购买：同时校验商品状态、库存、学生积分，保证数据一致 */
  function purchase(studentId: string, productId: string): OpResult {
    const product = state.products.find((p) => p.id === productId)
    const student = state.students.find((s) => s.id === studentId)
    if (!product) return { ok: false, message: '商品不存在或已被删除' }
    if (product.status !== 'on') return { ok: false, message: '商品已下架，无法购买' }
    if (product.stock <= 0) return { ok: false, message: '商品缺货，无法购买' }
    if (!student) return { ok: false, message: '学生不存在' }
    const price = actualPrice(product)
    if (price <= 0) return { ok: false, message: '商品价格无效' }
    if (!state.settings.allowNegativePurchase && student.points < price) {
      return { ok: false, message: `积分不足（还需 ${price - student.points} 分）` }
    }
    const now = new Date().toISOString()
    const before = student.points
    product.stock -= 1
    product.updatedAt = now
    student.points -= price
    student.updatedAt = now
    state.records.push({
      id: genId(),
      studentId: student.id,
      groupId: student.groupId,
      type: 'purchase',
      score: -price,
      reason: `购买「${product.name}」`,
      time: now,
      operatorType: '普通',
      note: `商品单价 ${price} 分`,
      productId: product.id,
      productName: product.name,
      beforePoints: before,
      afterPoints: student.points
    })
    return { ok: true }
  }

  /**
   * 幸运大转盘结算：一次性完成「扣除抽奖积分 + 扣减库存 + 写入中奖记录」，
   * 任一项校验不通过则不做任何修改，保证积分、库存与记录三者一致。
   */
  function settleLottery(input: LotterySettleInput): OpResult {
    const student = state.students.find((x) => x.id === input.studentId)
    if (!student) return { ok: false, message: '学生不存在' }
    const cost = Math.max(0, Math.floor(input.cost) || 0)
    if (cost > 0 && !state.settings.allowNegative && student.points < cost) {
      return { ok: false, message: `积分不足（还需 ${cost - student.points} 分）` }
    }
    const product = input.productId ? state.products.find((p) => p.id === input.productId) : null
    const stockProduct = input.deductStock ? product : null
    if (stockProduct && stockProduct.stock <= 0) {
      return { ok: false, message: '奖品库存不足，无法发放' }
    }
    const now = new Date().toISOString()
    const before = student.points
    student.points -= cost
    student.updatedAt = now
    if (stockProduct) {
      stockProduct.stock -= 1
      stockProduct.updatedAt = now
      if (stockProduct.stock <= 0) stockProduct.restockAt = now
    }
    state.records.push({
      id: genId(),
      studentId: student.id,
      groupId: student.groupId,
      type: 'other',
      score: -cost,
      reason: `幸运大转盘中奖「${input.awardName}」`,
      time: now,
      operatorType: '普通',
      note: stockProduct ? `抽奖消耗 ${cost} 分 · 已扣减库存 1 件` : `抽奖消耗 ${cost} 分`,
      productId: product?.id ?? null,
      productName: product?.name ?? null,
      beforePoints: before,
      afterPoints: student.points
    })
    return { ok: true }
  }

  // ===== 记录管理 =====
  function removeRecord(id: string): void {
    state.records = state.records.filter((r) => r.id !== id)
  }

  function clearRecords(): void {
    state.records = []
  }

  // ===== 导入导出 =====
  function exportSnapshot(): DataState {
    return {
      version: state.version,
      settings: { ...state.settings },
      students: state.students.map((s) => ({ ...s })),
      records: state.records.map((r) => ({ ...r })),
      products: state.products.map((p) => ({ ...p })),
      groups: state.groups.map((g) => ({ ...g })),
      honors: state.honors.map((h) => ({ ...h }))
    }
  }

  /** 校验导入数据结构，失败返回错误信息 */
  function validateImport(raw: unknown): { ok: boolean; message?: string } {
    if (!raw || typeof raw !== 'object') return { ok: false, message: '文件内容不是有效的 JSON 对象' }
    const r = raw as Record<string, unknown>
    if (r.app !== 'milk-class-points') return { ok: false, message: '不是牛奶智慧班级积分的备份文件' }
    const data = r.data
    if (!data || typeof data !== 'object') return { ok: false, message: '备份文件中缺少 data 数据' }
    const d = data as Record<string, unknown>
    if (!Array.isArray(d.students) || !Array.isArray(d.records) || !Array.isArray(d.products) || !Array.isArray(d.groups) || !Array.isArray(d.honors)) {
      return { ok: false, message: '备份文件数据结构不完整' }
    }
    return { ok: true }
  }

  /** 覆盖导入：先校验，成功后才替换（失败不破坏当前数据） */
  function importSnapshot(data: DataState): void {
    const normalized = normalize(data)
    Object.assign(state, normalized)
    dataRevision.value++
  }

  // ===== 数据重置 =====
  function resetBusinessData(): void {
    const settings = { ...state.settings }
    state.students = []
    state.records = []
    state.products = []
    state.groups = []
    state.honors = []
    state.settings = settings
    dataRevision.value++
  }

  function clearAllData(): void {
    const fresh = createEmptyData()
    const now = new Date().toISOString()
    fresh.settings.createdAt = now
    fresh.settings.updatedAt = now
    Object.assign(state, fresh)
    dataRevision.value++
  }

  // ===== 派生数据 =====
  function studentById(id: string | null): Student | undefined {
    if (!id) return undefined
    return state.students.find((s) => s.id === id)
  }

  function groupById(id: string | null): Group | undefined {
    if (!id) return undefined
    return state.groups.find((g) => g.id === id)
  }

  function productById(id: string | null): Product | undefined {
    if (!id) return undefined
    return state.products.find((p) => p.id === id)
  }

  function studentName(id: string | null): string {
    return studentById(id)?.name ?? '未知学生'
  }

  function groupName(id: string | null): string {
    return groupById(id)?.name ?? '未分组'
  }

  function groupMembers(groupId: string): Student[] {
    return state.students.filter((s) => s.groupId === groupId && s.enabled)
  }

  function groupPoints(groupId: string): number {
    return groupMembers(groupId).reduce((sum, s) => sum + s.points, 0)
  }

  function groupRank(groupId: string): number {
    const ranks = state.groups
      .map((g) => ({ id: g.id, points: groupPoints(g.id) }))
      .sort((a, b) => b.points - a.points)
    const idx = ranks.findIndex((r) => r.id === groupId)
    return idx === -1 ? 0 : idx + 1
  }

  function studentRank(studentId: string): number {
    const ranks = state.students
      .filter((s) => s.enabled)
      .map((s) => ({ id: s.id, points: s.points }))
      .sort((a, b) => b.points - a.points)
    const idx = ranks.findIndex((r) => r.id === studentId)
    return idx === -1 ? 0 : idx + 1
  }

  function recordsOfStudent(studentId: string): PointsRecord[] {
    return state.records
      .filter((r) => r.studentId === studentId)
      .sort((a, b) => (a.time < b.time ? 1 : -1))
  }

  return {
    state,
    dataRevision,
    loaded: () => loaded,
    init,
    flush,
    updateSettings,
    setPasswordHash,
    addStudent,
    updateStudent,
    removeStudents,
    toggleStudentEnabled,
    addGroup,
    updateGroup,
    removeGroup,
    setStudentGroup,
    addProduct,
    updateProduct,
    removeProduct,
    restockProduct,
    toggleProductStatus,
    addHonor,
    updateHonor,
    removeHonor,
    addPoints,
    deductPoints,
    purchase,
    settleLottery,
    removeRecord,
    clearRecords,
    exportSnapshot,
    validateImport,
    importSnapshot,
    resetBusinessData,
    clearAllData,
    studentById,
    groupById,
    productById,
    studentName,
    groupName,
    groupMembers,
    groupPoints,
    groupRank,
    studentRank,
    recordsOfStudent
  }
})

// ===== 商品价格计算（整数运算，避免浮点误差） =====
export function actualPrice(product: Pick<Product, 'originalPrice' | 'discount'>): number {
  const discount = product.discount >= 100 ? 100 : Math.max(1, Math.floor(product.discount))
  return Math.floor((product.originalPrice * discount) / 100)
}

/** 学生按拼音排序（稳定：姓名相同按创建时间/id） */
export function sortStudentsByPinyin(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const pa = pinyinFull(a.name)
    const pb = pinyinFull(b.name)
    if (pa !== pb) return pa < pb ? -1 : 1
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

export type { AddPointsOptions, OpResult }
