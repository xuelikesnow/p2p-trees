import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'

const app = createApp(App)
app.use(router)
app.mount('#app')

// Keep the tab title in sync with the active route.
router.afterEach((to) => {
  const base = 'do you think trees remember us?'
  document.title = to.meta?.title ? `${to.meta.title} · ${base}` : base
})
