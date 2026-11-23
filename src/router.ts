import { createRouter, createWebHashHistory } from 'vue-router'
import { useStore } from './store/index'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/LandingView.vue') },
    { path: '/design', component: () => import('./views/DesignView.vue') },
    { path: '/order', component: () => import('./views/OrderView.vue'), meta: { requiresDesign: true } },
    { path: '/payment', component: () => import('./views/PaymentView.vue'), meta: { requiresOrder: true } },
    { path: '/confirm/:orderId', component: () => import('./views/ConfirmView.vue') },
    { path: '/admin/login', component: () => import('./views/admin/AdminLoginView.vue') },
    {
      path: '/admin',
      component: () => import('./views/admin/AdminDashView.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/orders',
      component: () => import('./views/admin/AdminOrdersView.vue'),
      meta: { requiresAdmin: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const store = useStore()
  store.restoreAdminSession()
  if (to.meta.requiresAdmin && !store.isAdmin) return '/admin/login'
  if (to.meta.requiresDesign && store.design.placedImages.length === 0 && !store.design.popularDesignId) return '/design'
  if (to.meta.requiresOrder && !store.delivery.recipientName) return '/order'
})

export default router
