// ===== 全局数据类型定义 =====

/** 性别 */
export type Gender = 'male' | 'female'

/** 积分记录类型 */
export type RecordType = 'add' | 'deduct' | 'purchase' | 'other'

/** 操作人类型 */
export type OperatorType = '普通' | '管理员'

/** 商品状态 */
export type ProductStatus = 'on' | 'off' | 'deleted'

/** 哈希算法 */
export type HashAlgo = 'SHA-256' | 'SHA-512' | 'SHA-1'

/** 密码哈希存储结构（不保存明文） */
export interface PasswordHash {
  algo: HashAlgo
  salt: string
  hash: string
}

/** 系统设置 */
export interface WheelCustomAward {
  id: string
  name: string
  weight: number
}

export interface SystemSettings {
  passwordHash: PasswordHash | null
  theme: string
  themeMode: 'light' | 'dark' | 'system'
  backgroundImage: string | null
  /** 软件图标（本地 PNG，dataURL 持久化；为空时使用内置牛奶图标） */
  appLogo: string | null
  classAvatar: string | null
  className: string
  classSlogan: string
  classIntro: string
  teacherName: string
  allowNegative: boolean
  allowNegativePurchase: boolean
  wheelCostEnabled: boolean
  wheelCostAmount: number
  wheelCustomAwards: WheelCustomAward[]
  /** 大转盘：商品奖项权重与扣库存设置（按商品 id） */
  wheelProductAwards: Record<string, { weight: number; deductStock: boolean }>
  addReasons: string[]
  deductReasons: string[]
  createdAt: string
  updatedAt: string
}

/** 学生 */
export interface Student {
  id: string
  name: string
  gender: Gender
  className: string
  points: number
  groupId: string | null
  avatar: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** 积分记录 */
export interface PointsRecord {
  id: string
  studentId: string | null
  groupId: string | null
  type: RecordType
  /** 有符号分数：加分为正，减分/购买为负 */
  score: number
  reason: string
  time: string
  operatorType: OperatorType
  note: string
  productId: string | null
  /** 商品名称快照，避免商品删除后历史记录无法查看 */
  productName: string | null
  beforePoints: number | null
  afterPoints: number | null
}

/** 商品 */
export interface Product {
  id: string
  name: string
  image: string | null
  description: string
  originalPrice: number
  /** 折扣百分比：1-100，100 表示无折扣 */
  discount: number
  stock: number
  status: ProductStatus
  category: string
  createdAt: string
  updatedAt: string
  restockAt: string | null
}

/** 小组 */
export interface Group {
  id: string
  name: string
  /** 小组首字 */
  initial: string
  color: string
  icon: string | null
  leaderId: string | null
  createdAt: string
}

/** 荣誉 */
export interface Honor {
  id: string
  name: string
  image: string | null
  awardedAt: string
  description: string
  createdAt: string
}

/** 完整业务数据快照（用于持久化与导入导出） */
export interface DataState {
  version: number
  settings: SystemSettings
  students: Student[]
  records: PointsRecord[]
  products: Product[]
  groups: Group[]
  honors: Honor[]
}
