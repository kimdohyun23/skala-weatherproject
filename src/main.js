import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'


import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { activityLogger, installActivityLogger } from './utils/activityLogger.js'

const app = createApp(App)

app.config.errorHandler = (error, _instance, info) => {
  activityLogger.error('Vue', '애플리케이션 오류', {
    message: error.message,
    info,
  })
}

window.addEventListener('error', (event) => {
  activityLogger.error('브라우저', '실행 오류', {
    message: event.message,
  })
})

window.addEventListener('unhandledrejection', (event) => {
  activityLogger.error('비동기', '처리되지 않은 Promise 오류', {
    message: event.reason?.message || String(event.reason),
  })
})

installActivityLogger(router)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')

activityLogger.success('앱', '하늘결 애플리케이션 실행 완료')
