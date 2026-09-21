import { createRouter, createWebHashHistory } from 'vue-router';
import { authState, loadCurrentUser } from '../store/auth.js';

import Login from '../components/Login.js';
import Onboarding from '../components/Onboarding.js';
import Dashboard from '../components/Dashboard.js';
import PermitDetail from '../components/PermitDetail.js';
import NewApplication from '../components/NewApplication.js';
import ReviewerQueue from '../components/ReviewerQueue.js';
import ReviewDetail from '../components/ReviewDetail.js';

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/onboarding', component: Onboarding, meta: { role: 'applicant' } },
  { path: '/dashboard', component: Dashboard, meta: { role: 'applicant' } },
  { path: '/applications/new', component: NewApplication, meta: { role: 'applicant' } },
  { path: '/applications/:id', component: PermitDetail, meta: { role: 'applicant' } },
  { path: '/reviewer', component: ReviewerQueue, meta: { role: 'staff' } },
  { path: '/reviewer/applications/:id', component: ReviewDetail, meta: { role: 'staff' } },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (!authState.loaded) {
    await loadCurrentUser().catch(() => null);
  }

  const user = authState.user;

  if (to.meta.public) {
    if (user) {
      return user.role === 'staff' ? '/reviewer' : (user.onboarding_completed ? '/dashboard' : '/onboarding');
    }
    return true;
  }

  if (!user) {
    return '/login';
  }

  if (to.meta.role && to.meta.role !== user.role) {
    return user.role === 'staff' ? '/reviewer' : '/dashboard';
  }

  if (user.role === 'applicant' && !user.onboarding_completed && to.path !== '/onboarding') {
    return '/onboarding';
  }

  return true;
});
