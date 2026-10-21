<script setup lang="ts">
import type { QuizDetail, QuizSummary } from '@quiz/shared';
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { quizzesApi } from '@/api/quizzes';
import ImportQuizDialog from '@/components/ImportQuizDialog.vue';
import HostGameDialog from '@/components/game/HostGameDialog.vue';
import { quizTheme, shortTitle } from '@/brand/topics';
import Mascot from '@/components/Mascot.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';

const PAGE_SIZE = 24;

const { t, locale } = useI18n();
const router = useRouter();
const toast = useToast();

const items = ref<QuizSummary[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const auth = useAuthStore();
const mine = ref(false);
watch(mine, () => void load(true));

/** Sample quizzes and other people's quizzes can only be duplicated (admins may change any non-sample quiz). */
function canEdit(quiz: QuizSummary): boolean {
  if (!auth.canEditQuizzes || quiz.isSample) return false;
  return !quiz.ownerId || quiz.ownerId === auth.user?.id || auth.user?.isAdmin === true;
}
const loading = ref(false);
const loadError = ref('');
const importOpen = ref(false);
const hosting = ref<QuizSummary | null>(null);

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.isNetworkError) return t('common.networkError');
  return error instanceof Error ? error.message : t('common.error');
}

async function load(reset: boolean): Promise<void> {
  loading.value = true;
  loadError.value = '';
  const nextPage = reset ? 1 : page.value + 1;
  try {
    const result = await quizzesApi.list({ search: search.value.trim() || undefined, mine: mine.value || undefined, page: nextPage, pageSize: PAGE_SIZE });
    items.value = reset ? result.items : [...items.value, ...result.items];
    total.value = result.total;
    page.value = nextPage;
  } catch (error) {
    loadError.value = errorText(error);
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(true), 300);
});

onMounted(() => void load(true));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value === 'mn' ? 'mn-MN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function duplicate(quiz: QuizSummary): Promise<void> {
  try {
    const copy = await quizzesApi.duplicate(quiz.id);
    toast.success(t('quizList.duplicated'));
    await router.push({ name: 'quiz-edit', params: { id: copy.id } });
  } catch (error) {
    toast.error(errorText(error));
  }
}

async function remove(quiz: QuizSummary): Promise<void> {
  if (!window.confirm(t('quizList.deleteConfirm', { title: quiz.title }))) return;
  try {
    await quizzesApi.remove(quiz.id);
    items.value = items.value.filter((q) => q.id !== quiz.id);
    total.value -= 1;
    toast.success(t('quizList.deleted'));
  } catch (error) {
    toast.error(errorText(error));
  }
}

function onImported(quiz: QuizDetail): void {
  importOpen.value = false;
  void router.push({ name: 'quiz-edit', params: { id: quiz.id } });
}
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-8">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="w-full text-3xl font-bold sm:mr-auto sm:w-auto">{{ t('quizList.title') }}</h1>
      <template v-if="auth.canEditQuizzes">
        <button type="button" class="btn-secondary" @click="importOpen = true">{{ t('quizList.import') }}</button>
        <RouterLink to="/quizzes/new" class="btn-primary">{{ t('nav.create') }}</RouterLink>
      </template>
    </div>

    <label class="mt-6 block">
      <span class="sr-only">{{ t('quizList.search') }}</span>
      <input v-model="search" type="search" class="input" :placeholder="t('quizList.search')" />
    </label>
    <div v-if="auth.user" class="mt-3 flex gap-1" role="group" :aria-label="t('quizList.filter')">
      <button
        v-for="option in [false, true]"
        :key="String(option)"
        type="button"
        class="btn-ghost"
        :class="mine === option ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : ''"
        :aria-pressed="mine === option"
        @click="mine = option"
      >
        {{ option ? t('quizList.mine') : t('quizList.all') }}
      </button>
    </div>

    <div v-if="loadError" class="mt-8 rounded-2xl bg-red-50 dark:bg-red-950/40 p-6 text-center text-red-700 dark:text-red-300" role="alert">
      <p class="font-bold">{{ loadError }}</p>
      <button type="button" class="btn-secondary mt-4" @click="load(true)">{{ t('common.retry') }}</button>
    </div>

    <div v-else-if="!loading && items.length === 0" class="mt-12 flex flex-col items-center text-center text-slate-500 dark:text-slate-400">
      <Mascot :mood="search.trim() ? 'thinking' : 'wave'" :size="130" />
      <p class="mt-2">{{ search.trim() ? t('quizList.noResults', { query: search.trim() }) : t('quizList.empty') }}</p>
    </div>

    <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="quiz in items" :key="quiz.id" class="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
        <div class="relative h-24 bg-gradient-to-br p-4" :class="quizTheme(quiz.title).gradient">
          <span class="absolute -bottom-3 right-4 text-6xl drop-shadow-lg transition duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true">
            {{ quizTheme(quiz.title).icon }}
          </span>
          <div class="flex gap-1.5">
            <span v-if="quiz.isSample" class="chip bg-black/25 text-white backdrop-blur">{{ t('quizList.sample') }}</span>
            <span class="chip bg-black/25 uppercase text-white backdrop-blur">{{ quiz.language }}</span>
          </div>
        </div>
        <div class="flex flex-1 flex-col p-5">
        <div class="flex items-start gap-2">
          <RouterLink
            :to="{ name: 'quiz-edit', params: { id: quiz.id } }"
            class="mr-auto font-display text-base font-bold leading-snug hover:text-brand-600"
          >
            {{ shortTitle(quiz.title) }}
          </RouterLink>
        </div>
        <p v-if="quiz.description" class="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{{ quiz.description }}</p>
        <p class="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {{ t('quizList.rounds', { n: quiz.roundCount }, quiz.roundCount) }} ·
          {{ t('quizList.questions', { n: quiz.questionCount }, quiz.questionCount) }}
        </p>
        <p class="mb-4 text-xs text-slate-400">{{ t('quizList.updated', { date: formatDate(quiz.updatedAt) }) }}</p>
        <div class="mt-auto flex flex-wrap gap-1 border-t border-slate-100 pt-3 dark:border-white/10">
          <button
            type="button"
            class="btn-primary"
            :disabled="quiz.questionCount === 0"
            :title="quiz.questionCount === 0 ? t('quizList.hostEmpty') : undefined"
            @click="hosting = quiz"
          >
            ▶ {{ t('quizList.host') }}
          </button>
          <RouterLink v-if="canEdit(quiz)" :to="{ name: 'quiz-edit', params: { id: quiz.id } }" class="btn-ghost">
            {{ t('common.edit') }}
          </RouterLink>
          <RouterLink v-else :to="{ name: 'quiz-edit', params: { id: quiz.id } }" class="btn-ghost">{{ t('home.preview') }}</RouterLink>
          <details class="relative ml-auto">
            <summary class="btn-icon cursor-pointer list-none text-xl [&::-webkit-details-marker]:hidden" :aria-label="t('quizList.more')" :title="t('quizList.more')">
              ⋯
            </summary>
            <div class="card absolute bottom-full right-0 z-10 mb-2 flex min-w-48 flex-col p-1.5 shadow-xl">
              <button v-if="auth.canEditQuizzes" type="button" class="btn-ghost justify-start" @click="duplicate(quiz)">
                {{ t('common.duplicate') }}
              </button>
              <a :href="quizzesApi.exportUrl(quiz.id, 'json')" class="btn-ghost justify-start">{{ t('quizList.exportJson') }}</a>
              <a :href="quizzesApi.exportUrl(quiz.id, 'csv')" class="btn-ghost justify-start">{{ t('quizList.exportCsv') }}</a>
              <button v-if="canEdit(quiz)" type="button" class="btn-danger justify-start" @click="remove(quiz)">
                {{ t('common.delete') }}
              </button>
            </div>
          </details>
        </div>
        </div>
      </li>
    </ul>

    <p v-if="loading" class="mt-8 text-center text-slate-500 dark:text-slate-400">{{ t('common.loading') }}</p>
    <div v-else-if="items.length < total" class="mt-8 text-center">
      <button type="button" class="btn-secondary" @click="load(false)">{{ t('quizList.loadMore') }}</button>
    </div>

    <ImportQuizDialog :open="importOpen" @close="importOpen = false" @imported="onImported" />
    <HostGameDialog :quiz="hosting" @close="hosting = null" />
  </section>
</template>
