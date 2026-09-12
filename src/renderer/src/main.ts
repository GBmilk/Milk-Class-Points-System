import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import VChart from 'vue-echarts'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import { useDataStore } from './stores/data'
import './assets/echarts'
import './assets/base.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.component('VChart', VChart)

async function bootstrap(): Promise<void> {
  // 先加载本地数据，再挂载应用，保证重启后数据仍在
  const data = useDataStore()
  await data.init()
  app.mount('#app')
}

void bootstrap()
