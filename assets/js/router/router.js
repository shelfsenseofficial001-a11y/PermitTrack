import { createRouter, createWebHashHistory } from 'vue-router';
import { authState, loadCurrentUser, homePathFor } from '../store/auth.js?v=129';

import Landing from '../components/Landing.js?v=129';
import Login from '../components/Login.js?v=129';
import Register from '../components/Register.js?v=129';
import Verify from '../components/Verify.js?v=129';
import StaffLogin from '../components/StaffLogin.js?v=129';
import Dashboard from '../components/Dashboard.js?v=129';
import MyPermits from '../components/MyPermits.js?v=129';
import Notifications from '../components/Notifications.js?v=129';
import NotFound from '../components/NotFound.js?v=129';
import PermitDetail from '../components/PermitDetail.js?v=129';
import NewApplication from '../components/NewApplication.js?v=129';
import ReviewerQueue from '../components/ReviewerQueue.js?v=129';
import ReviewDetail from '../components/ReviewDetail.js?v=129';
import ResidencyUpgrade from '../components/ResidencyUpgrade.js?v=129';
import ResidencyQueue from '../components/ResidencyQueue.js?v=129';
import ResidencyReview from '../components/ResidencyReview.js?v=129';
import BusinessForm from '../components/BusinessForm.js?v=129';
import BusinessQueue from '../components/BusinessQueue.js?v=129';
import BusinessReview from '../components/BusinessReview.js?v=129';
import Admin from '../components/Admin.js?v=129';
import Profile from '../components/Profile.js?v=129';
import { openChangePassword } from '../store/ui.js?v=129';

const routes = [
  // Signed-out visitors get the landing page; signed-in users go to their home (guard below)
  { path: '/', component: Landing, meta: { public: true } },
  { path: '/login', component: Login, meta: { public: true } },
  { path: '/register', component: Register, meta: { public: true } },
  { path: '/verify', component: Verify, meta: { public: true } },
  { path: '/staff/login', component: StaffLogin, meta: { public: true } },
  { path: '/staff', redirect: '/staff/login' },
  { path: "/dashboard", component: Dashboard, meta: { role: "applicant" } },
  { path: "/permits", component: MyPermits, meta: { role: "applicant" } },
  { path: '/notifications', component: Notifications, meta: { role: 'applicant' } },
  { path: '/applications/new', component: NewApplication, meta: { role: 'applicant' } },
  { path: '/applications/:id', component: PermitDetail, meta: { role: 'applicant' } },
  { path: '/residency', component: ResidencyUpgrade, meta: { role: 'applicant' } },
  { path: '/businesses/new', component: BusinessForm, meta: { role: 'applicant' } },
  { path: '/businesses/:id', component: BusinessForm, meta: { role: 'applicant' } },
  { path: '/reviewer', component: ReviewerQueue, meta: { role: 'staff' } },
  { path: '/reviewer/applications/:id', component: ReviewDetail, meta: { role: 'staff' } },
  { path: '/staff/residency', component: ResidencyQueue, meta: { role: 'staff' } },
  { path: '/staff/residency/:id', component: ResidencyReview, meta: { role: 'staff' } },
  { path: '/staff/businesses', component: BusinessQueue, meta: { role: 'staff' } },
  { path: '/staff/businesses/:id', component: BusinessReview, meta: { role: 'staff' } },
  { path: '/admin/:tab?', component: Admin, meta: { role: 'admin' } },
  { path: '/account', component: Profile },
  // Changing a password is a dialog now; old links and bookmarks are handled in the guard below
  { path: '/account/password', component: { template: '' } },
  // Unknown addresses get a real 404 rather than a silent bounce to the landing page
  { path: '/:pathMatch(.*)*', component: NotFound, meta: { public: true } },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Admin can open every staff page (superadmin)
function hasRole(user, role) {
  return user.role === role || (role === 'staff' && user.role === 'admin');
}

router.beforeEach(async (to, from) => {
  if (!authState.loaded) {
    await loadCurrentUser().catch(() => null);
  }

  const user = authState.user;

  if (to.path === '/') {
    // Opening the app while signed in lands on your own home page. Asking for the landing page
    // from inside the app (the header logo links here) is deliberate, so it is honoured —
    // from.matched is empty only on that very first load.
    return user && !from.matched.length ? homePathFor(user) : true;
  }

  // The old Change password page: open the dialog over the home page instead. Done here
  // rather than as a route redirect because only now is it known whether anyone is signed in.
  if (to.path === '/account/password') {
    if (user) openChangePassword();
    return homePathFor(user);
  }

  // Login pages stay reachable while signed in, so users can switch accounts
  if (to.meta.public) {
    return true;
  }

  if (!user) {
    // Staff and Admin pages send signed-out visitors to the staff login page
    return to.meta.role === 'staff' || to.meta.role === 'admin' ? '/staff/login' : '/login';
  }

  // A temporary password is enforced by the dialog in app.js, which covers every page

  if (to.meta.role && !hasRole(user, to.meta.role)) {
    return homePathFor(user);
  }

  return true;
});
