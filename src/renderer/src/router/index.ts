// ===== 路由定义 =====
import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: '登录' }
    },
    {
      path: '/',
      component: () => import('../components/AppLayout.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '首页' } },
        { path: 'students', name: 'students', component: () => import('../views/StudentsView.vue'), meta: { title: '学生管理' } },
        { path: 'points', name: 'points', component: () => import('../views/PointsView.vue'), meta: { title: '积分管理' } },
        { path: 'records', name: 'records', component: () => import('../views/RecordsView.vue'), meta: { title: '积分记录' } },
        { path: 'store', name: 'store', component: () => import('../views/StoreView.vue'), meta: { title: '积分商店' } },
        { path: 'wheel', name: 'wheel', component: () => import('../views/WheelView.vue'), meta: { title: '幸运大转盘' } },
        { path: 'groups', name: 'groups', component: () => import('../views/GroupsView.vue'), meta: { title: '小组管理' } },
        { path: 'leaderboard', name: 'leaderboard', component: () => import('../views/LeaderboardView.vue'), meta: { title: '排行榜' } },
        { path: 'honors', name: 'honors', component: () => import('../views/HonorsView.vue'), meta: { title: '班级荣誉' } },
        { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '系统设置' } }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.path !== '/login' && !auth.loggedIn) return { path: '/login' }
  if (to.path === '/login' && auth.loggedIn) return { path: '/' }
  return true
})

export default router
