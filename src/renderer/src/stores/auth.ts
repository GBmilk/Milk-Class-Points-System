// ===== 登录认证（仅内存会话，不持久化登录状态） =====
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { OperatorType } from '../types'
import { verifyPassword, createPasswordHash, type HashAlgo } from '../utils/crypto'
import { useDataStore } from './data'

export const useAuthStore = defineStore('auth', () => {
  const loggedIn = ref(false)
  const operatorType = ref<OperatorType>('普通')
  const failedCount = ref(0)

  /**
   * 是否为管理员身份：只有使用管理员密码（pwd 文件）登录后才为 true。
   * 用于限制积分记录删除等敏感操作，必须依据实际登录身份判断。
   */
  const isAdmin = computed(() => operatorType.value === '管理员')

  /**
   * 登录：先验证普通密码（本地哈希），再尝试管理员密码（主进程 pwd 文件）。
   * 管理员密码只在主进程内校验，明文不会返回给渲染进程。
   */
  async function login(password: string): Promise<{ ok: boolean; message?: string }> {
    // 先校验管理员密码（pwd 文件，仅主进程内比对）：管理员身份仅由此产生
    try {
      const adminOk = await window.api.pwdVerify(password)
      if (adminOk) {
        loggedIn.value = true
        operatorType.value = '管理员'
        failedCount.value = 0
        return { ok: true }
      }
    } catch (e) {
      console.error('管理员密码验证失败', e)
    }

    // 再校验普通密码（本地哈希）
    const data = useDataStore()
    const ph = data.state.settings.passwordHash
    if (ph) {
      const normalOk = await verifyPassword(password, ph)
      if (normalOk) {
        loggedIn.value = true
        operatorType.value = '普通'
        failedCount.value = 0
        return { ok: true }
      }
    }

    failedCount.value += 1
    const count = failedCount.value
    if (count >= 3) {
      return { ok: false, message: `密码错误，已尝试 ${count} 次，请核对后重试` }
    }
    return { ok: false, message: '密码错误，请重新输入' }
  }

  function logout(): void {
    loggedIn.value = false
    operatorType.value = '普通'
    failedCount.value = 0
  }

  /** 修改普通密码：验证旧密码，写入新哈希 */
  async function changePassword(oldPassword: string, newPassword: string, algo: HashAlgo): Promise<{ ok: boolean; message?: string }> {
    const data = useDataStore()
    const ph = data.state.settings.passwordHash
    if (ph) {
      const oldOk = await verifyPassword(oldPassword, ph)
      if (!oldOk) return { ok: false, message: '旧密码不正确' }
    } else {
      return { ok: false, message: '系统尚未初始化密码' }
    }
    if (newPassword.length < 6) return { ok: false, message: '新密码长度至少 6 位' }
    const hash = await createPasswordHash(newPassword, algo)
    data.setPasswordHash(hash)
    return { ok: true }
  }

  return { loggedIn, operatorType, isAdmin, failedCount, login, logout, changePassword }
})
