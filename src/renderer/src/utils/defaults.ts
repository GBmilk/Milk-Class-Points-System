// ===== 默认数据与初始化 =====
import type { DataState, SystemSettings } from '../types'

/** 首次运行默认密码（仅用于初始化，不在任何界面中显示） */
export const DEFAULT_PASSWORD = '123456'

/** 默认加分原因（10 条） */
export const DEFAULT_ADD_REASONS = [
  '课堂表现优秀',
  '积极回答问题',
  '作业完成优秀',
  '帮助同学',
  '遵守纪律',
  '主动劳动',
  '取得进步',
  '参加活动',
  '获得表扬',
  '其他奖励'
]

/** 默认减分原因（10 条） */
export const DEFAULT_DEDUCT_REASONS = [
  '课堂纪律问题',
  '未按时完成作业',
  '作业质量较差',
  '上课讲话',
  '上课走神',
  '不遵守班级规定',
  '损坏公共物品',
  '不服从安排',
  '扣除奖励积分',
  '其他扣分'
]

export function createDefaultSettings(): SystemSettings {
  const now = new Date().toISOString()
  return {
    passwordHash: null,
    theme: 'sky-blue-gradient',
    themeMode: 'system',
    backgroundImage: null,
    appLogo: null,
    classAvatar: null,
    className: '我的班级',
    classSlogan: '团结 · 友爱 · 进步',
    classIntro: '',
    teacherName: '',
    allowNegative: false,
    allowNegativePurchase: false,
    wheelCostEnabled: false,
    wheelCostAmount: 5,
    wheelCustomAwards: [],
    wheelProductAwards: {},
    addReasons: [...DEFAULT_ADD_REASONS],
    deductReasons: [...DEFAULT_DEDUCT_REASONS],
    createdAt: now,
    updatedAt: now
  }
}

export const DATA_VERSION = 1

export function createEmptyData(): DataState {
  return {
    version: DATA_VERSION,
    settings: createDefaultSettings(),
    students: [],
    records: [],
    products: [],
    groups: [],
    honors: []
  }
}
