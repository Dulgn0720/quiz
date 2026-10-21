import { createRouter, createWebHistory } from 'vue-router';
import { authToken } from '@/auth/token';
import HomeView from '@/views/HomeView.vue';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/quizzes', name: 'quizzes', component: () => import('@/views/QuizListView.vue') },
    {
      path: '/quizzes/new',
      name: 'quiz-new',
      component: () => import('@/views/QuizEditorView.vue'),
    },
    {
      path: '/quizzes/:id/edit',
      name: 'quiz-edit',
      component: () => import('@/views/QuizEditorView.vue'),
      props: true,
    },
    { path: '/login', name: 'login', component: () => import('@/views/AuthView.vue'), props: { mode: 'login' } },
    { path: '/register', name: 'register', component: () => import('@/views/AuthView.vue'), props: { mode: 'register' } },
    { path: '/forgot-password', name: 'forgot-password', component: () => import('@/views/ForgotPasswordView.vue') },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPasswordView.vue'),
      props: (route) => ({ token: typeof route.query.token === 'string' ? route.query.token : '' }),
    },
    {
      path: '/portal',
      name: 'portal',
      component: () => import('@/views/PortalSignInView.vue'),
      props: (route) => ({
        token: typeof route.query.token === 'string' ? route.query.token : '',
        next: typeof route.query.next === 'string' ? route.query.next : '/',
      }),
    },
    { path: '/me', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true } },
    { path: '/leaderboard', name: 'leaderboard', component: () => import('@/views/LeaderboardView.vue') },
    { path: '/rooms', name: 'rooms', component: () => import('@/views/RoomsView.vue') },
    { path: '/join', name: 'join', component: () => import('@/views/JoinView.vue') },
    { path: '/join/:pin(\\d{6})', name: 'join-pin', component: () => import('@/views/JoinView.vue'), props: true },
    {
      path: '/play/:pin(\\d{6})',
      name: 'play',
      component: () => import('@/views/PlayView.vue'),
      props: true,
      // Phones need every pixel: the player screen has its own header.
      meta: { fullscreen: true },
    },
    {
      path: '/host/:pin(\\d{6})',
      name: 'host',
      component: () => import('@/views/HostView.vue'),
      props: true,
      // The host screen is shown on a projector: an immersive stage with its own header.
      meta: { fullscreen: true },
    },
    {
      path: '/practice/:id',
      name: 'practice',
      component: () => import('@/views/PracticeView.vue'),
      props: true,
      // Played on a phone like a live game, so it gets the same immersive screen.
      meta: { fullscreen: true },
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !authToken()) return { name: 'login', query: { redirect: to.fullPath } };
  return true;
});
