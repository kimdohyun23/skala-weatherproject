import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'WeatherLiveDashboard',
    component: () => import('../views/WeatherLiveDashboardView.vue'),
  },
  {
    path: '/about',
    name: 'WeatherAbout',
    component: () => import('../views/WeatherAboutView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  // 해시 라우팅을 사용하면 GitHub Pages에서도 새로고침 시 404가 발생하지 않습니다.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
