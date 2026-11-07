import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { getSetup } from '@/api/setup'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/setup', component: () => import('@/views/SetupView.vue') },
    { path: '/admin/release', component: () => import('@/views/ReleaseView.vue') },
    { path: '/', component: HomeView },
    {
      path: '/files/:category',
      component: () => import('@/views/FilesView.vue'),
    },
    {
      path: '/admin/categories',
      component: () => import('@/views/CategoryAdminView.vue'),
    },
  ],
})

router.beforeEach(async to => {
  if (to.path === '/setup') return true
  try { return (await getSetup()).ready ? true : '/setup' }
  catch { return '/setup' }
})

export default router
