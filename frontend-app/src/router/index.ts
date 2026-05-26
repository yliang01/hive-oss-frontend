import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
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

export default router
