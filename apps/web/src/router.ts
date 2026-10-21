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
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
