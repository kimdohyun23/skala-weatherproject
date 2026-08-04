import { createRouter, createWebHashHistory } from 'vue-router'
import WeatherHomeView from '../views/WeatherHomeView.vue'

const routes = [
  {
    path: '/',
    name: 'WeatherHome',
    component: WeatherHomeView,
  }, // ← 콤마 추가 (이게 빠져있었음)
  {
    path: '/about',
    name: 'WeatherAbout',
    component: () => import('../views/WeatherAboutView.vue'),
  },
  {
    path: '/dashboard',
    name: 'WeatherLiveDashboard',
    component: () => import('../views/WeatherLiveDashboardView.vue'),
  },
  {
    path: '/weather/:cityId',
    name: 'WeatherDetail',
    component: () => import('../views/WeatherDetailView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue'),
  },
]

const router = createRouter({
  // 해시 라우팅을 사용하면 GitHub Pages에서도 새로고침 시 404가 발생하지 않습니다.
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
