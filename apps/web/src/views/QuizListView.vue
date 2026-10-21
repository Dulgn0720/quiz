<script setup lang="ts">
import type { QuizDetail, QuizSummary } from '@quiz/shared';
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { quizzesApi } from '@/api/quizzes';
import ImportQuizDialog from '@/components/ImportQuizDialog.vue';
import HostGameDialog from '@/components/game/HostGameDialog.vue';
import { useToast } from '@/composables/useToast';

const PAGE_SIZE = 24;

const { t, locale } = useI18n();
const router = useRouter();
const toast = useToast();

const items = ref<QuizSummary[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
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
    const result = await quizzesApi.list({ search: search.value.trim() || undefined, page: nextPage, pageSize: PAGE_SIZE });
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
      <h1 class="mr-auto text-3xl font-black">{{ t('quizList.title') }}</h1>
      <button type="button" class="btn-secondary" @click="importOpen = true">{{ t('quizList.import') }}</button>
      <RouterLink to="/quizzes/new" class="btn-primary">{{ t('nav.create') }}</RouterLink>
    </div>

    <label class="mt-6 block">
      <span class="sr-only">{{ t('quizList.search') }}</span>
      <input v-model="search" type="search" class="input" :placeholder="t('quizList.search')" />
    </label>

    <div v-if="loadError" class="mt-8 rounded-2xl bg-red-50 p-6 text-center text-red-700" role="alert">
      <p class="font-bold">{{ loadError }}</p>
      <button type="button" class="btn-secondary mt-4" @click="load(true)">{{ t('common.retry') }}</button>
    </div>

    <p v-else-if="!loading && items.length === 0" class="mt-16 text-center text-slate-500">
      {{ search.trim() ? t('quizList.noResults', { query: search.trim() }) : t('quizList.empty') }}
    </p>

    <ul class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="quiz in items" :key="quiz.id" class="card flex flex-col p-5">
        <div class="flex items-start gap-2">
          <RouterLink
            :to="{ name: 'quiz-edit', params: { id: quiz.id } }"
            class="mr-auto text-lg font-black leading-tight hover:text-brand-700"
          >
            {{ quiz.title }}
          </RouterLink>
          <span v-if="quiz.isSample" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            {{ t('quizList.sample') }}
          </span>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-600">
            {{ quiz.language }}
          </span>
        </div>
        <p v-if="quiz.description" class="mt-2 line-clamp-2 text-sm text-slate-600">{{ quiz.description }}</p>
        <p class="mt-3 text-sm font-semibold text-slate-500">
          {{ t('quizList.rounds', { n: quiz.roundCount }, quiz.roundCount) }} ·
          {{ t('quizList.questions', { n: quiz.questionCount }, quiz.questionCount) }}
        </p>
        <p class="text-xs text-slate-400">{{ t('quizList.updated', { date: formatDate(quiz.updatedAt) }) }}</p>
        <div class="mt-4 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
          <button
            type="button"
            class="btn-primary"
            :disabled="quiz.questionCount === 0"
            :title="quiz.questionCount === 0 ? t('quizList.hostEmpty') : undefined"
            @click="hosting = quiz"
          >
            ▶ {{ t('quizList.host') }}
          </button>
          <RouterLink v-if="!quiz.isSample" :to="{ name: 'quiz-edit', params: { id: quiz.id } }" class="btn-ghost">
            {{ t('common.edit') }}
          </RouterLink>
          <button type="button" class="btn-ghost" @click="duplicate(quiz)">{{ t('common.duplicate') }}</button>
          <a :href="quizzesApi.exportUrl(quiz.id, 'json')" class="btn-ghost" :title="t('quizList.exportJson')">JSON</a>
          <a :href="quizzesApi.exportUrl(quiz.id, 'csv')" class="btn-ghost" :title="t('quizList.exportCsv')">CSV</a>
          <button v-if="!quiz.isSample" type="button" class="btn-danger ml-auto" @click="remove(quiz)">
            {{ t('common.delete') }}
          </button>
        </div>
      </li>
    </ul>

    <p v-if="loading" class="mt-8 text-center text-slate-500">{{ t('common.loading') }}</p>
    <div v-else-if="items.length < total" class="mt-8 text-center">
      <button type="button" class="btn-secondary" @click="load(false)">{{ t('quizList.loadMore') }}</button>
    </div>

    <ImportQuizDialog :open="importOpen" @close="importOpen = false" @imported="onImported" />
    <HostGameDialog :quiz="hosting" @close="hosting = null" />
  </section>
</template>
