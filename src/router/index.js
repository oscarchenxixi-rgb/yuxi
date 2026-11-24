import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { CASES } from '../data/cases'
import { legacyPagesLocation } from './pagesLocation'

const routes = [
  { path: '/', component: () => import('../pages/HomePage.vue') },
  { path: '/project', component: () => import('../pages/ProjectPage.vue') },
  { path: '/cases', component: () => import('../pages/CasesPage.vue') },
  { path: '/cases/:caseId', name: 'case-detail', component: () => import('../pages/CaseDetailPage.vue') },
  { path: '/simulation', component: () => import('../pages/SimulationPage.vue') },
  { path: '/visualization', component: () => import('../pages/VisualizationPage.vue') },
  { path: '/about', component: () => import('../pages/AboutPage.vue') },
  { path: '/404', component: () => import('../pages/NotFoundPage.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/404' }
]

const base = import.meta.env.BASE_URL
const pagesMode = import.meta.env.VITE_ROUTER_MODE === 'hash'
if (pagesMode) {
  const legacyUrl = legacyPagesLocation(window.location, base)
  if (legacyUrl) window.history.replaceState(window.history.state, '', legacyUrl)
}

const router = createRouter({
  history: pagesMode ? createWebHashHistory(base) : createWebHistory(base),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path !== from.path) return { top: 0, behavior: 'instant' }
  }
})

router.beforeEach((to) => {
  if (to.name === 'case-detail' && !CASES.some((item) => item.caseId === to.params.caseId)) {
    return { path: '/404', replace: true }
  }
})

export default router
