import { createRouter, createWebHistory } from 'vue-router'

// The app is a single full-bleed canvas. Routes exist only so the drawer
// state is reflected in the URL (back button + shareable /plant link):
//   /        → forest canvas, drawer closed
//   /plant   → forest canvas, drawer open
// App.vue derives its own state from the active route; no page components.
const Placeholder = { name: 'Placeholder', render: () => null }

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'forest', component: Placeholder, meta: { title: 'the forest' } },
    { path: '/plant', name: 'plant', component: Placeholder, meta: { title: 'plant a tree' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})
