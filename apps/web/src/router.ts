import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

export const router = createRouter({
  history: createWebHistory(),
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
    { path: '/host/:pin(\\d{6})', name: 'host', component: () => import('@/views/HostView.vue'), props: true },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
