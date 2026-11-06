import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/site.css'
import './assets/admin.css'
import './assets/programs.css'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
const auth = useAuthStore(pinia)
void auth.initialize()
if (import.meta.hot) import.meta.hot.dispose(() => auth.dispose())
app.use(router)

app.mount('#app')
