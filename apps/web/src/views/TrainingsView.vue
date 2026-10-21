<script setup lang="ts">
import { dailyDayKey, type QuizSummary, type TrainingSummary } from '@quiz/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiError } from '@/api/client';
import { quizzesApi } from '@/api/quizzes';
import { trainingsApi } from '@/api/trainings';
import Mascot from '@/components/Mascot.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';

/** Required trainings: employees see theirs, admins also assign new ones. */
const { t } = useI18n();
const auth = useAuthStore();
const toast = useToast();

const trainings = ref<TrainingSummary[]>([]);
const loaded = ref(false);
const failed = ref(false);
const isAdmin = computed(() => auth.user?.isAdmin === true);
const today = dailyDayKey();

async function load(): Promise<void> {
  failed.value = false;
  try {
    trainings.value = await trainingsApi.list();
  } catch {
    failed.value = true;
  } finally {
    loaded.value = true;
  }
}

const open = computed(() => trainings.value.filter((x) => x.active));
const closed = computed(() => trainings.value.filter((x) => !x.active));
const todoCount = computed(() => open.value.filter((x) => x.status !== 'passed').length);

const overdue = (x: TrainingSummary) => x.status !== 'passed' && !!x.dueDate && x.dueDate < today;

// ---- Admin: assign a training -------------------------------------------------
const quizzes = ref<QuizSummary[]>([]);
const form = ref({ quizId: '', title: '', passPercent: 80, dueDate: '', department: '' });
const creating = ref(false);
const showForm = ref(false);

async function loadQuizzes(): Promise<void> {
  try {
    quizzes.value = (await quizzesApi.list({ page: 1, pageSize: 100 })).items.filter((q) => q.questionCount > 0);
  } catch {
    quizzes.value = [];
  }
}

async function create(): Promise<void> {
  if (!form.value.quizId || creating.value) return;
  creating.value = true;
  try {
    await trainingsApi.create({
      quizId: form.value.quizId,
      title: form.value.title.trim() || undefined,
      passPercent: Number(form.value.passPercent) || 80,
      dueDate: form.value.dueDate || undefined,
      department: form.value.department.trim() || undefined,
    });
    toast.success(t('trainings.created'));
    form.value = { quizId: '', title: '', passPercent: 80, dueDate: '', department: '' };
    showForm.value = false;
    await load();
  } catch (e) {
    toast.error(e instanceof ApiError && e.status === 403 ? t('trainings.adminOnly') : t('common.error'));
  } finally {
    creating.value = false;
  }
}

async function toggle(x: TrainingSummary): Promise<void> {
  if (x.active && !window.confirm(t('trainings.closeConfirm', { title: x.title }))) return;
  try {
    await trainingsApi.setActive(x.id, !x.active);
    await load();
  } catch {
    toast.error(t('common.error'));
  }
}

onMounted(() => {
  void load();
  if (isAdmin.value) void loadQuizzes();
});
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-8">
    <div class="flex flex-wrap items-center gap-3">
      <div class="mr-auto">
        <h1 class="text-3xl font-bold">🎓 {{ t('trainings.title') }}</h1>
        <p class="mt-1 text-ink-600 dark:text-ink-300">{{ t('trainings.subtitle') }}</p>
      </div>
      <button v-if="isAdmin" type="button" class="btn-primary" @click="showForm = !showForm">
        {{ showForm ? t('common.cancel') : `+ ${t('trainings.assign')}` }}
      </button>
    </div>

    <!-- Admin: assign -->
    <Transition name="page">
      <form v-if="isAdmin && showForm" class="card mt-6 grid gap-4 p-5 sm:grid-cols-2" @submit.prevent="create">
        <label class="grid gap-1 sm:col-span-2">
          <span class="text-sm font-bold">{{ t('trainings.quiz') }}</span>
          <select v-model="form.quizId" class="input" required>
            <option value="" disabled>{{ t('trainings.pickQuiz') }}</option>
            <option v-for="q in quizzes" :key="q.id" :value="q.id">{{ q.title }} ({{ t('trainings.questions', { n: q.questionCount }) }})</option>
          </select>
        </label>
        <label class="grid gap-1 sm:col-span-2">
          <span class="text-sm font-bold">{{ t('trainings.name') }}</span>
          <input v-model="form.title" class="input" maxlength="120" :placeholder="t('trainings.namePlaceholder')" />
        </label>
        <label class="grid gap-1">
          <span class="text-sm font-bold">{{ t('trainings.passPercent') }}</span>
          <input v-model.number="form.passPercent" type="number" min="1" max="100" class="input" required />
        </label>
        <label class="grid gap-1">
          <span class="text-sm font-bold">{{ t('trainings.dueDate') }}</span>
          <input v-model="form.dueDate" type="date" class="input" />
        </label>
        <label class="grid gap-1 sm:col-span-2">
          <span class="text-sm font-bold">{{ t('trainings.department') }}</span>
          <input v-model="form.department" class="input" maxlength="40" :placeholder="t('trainings.departmentPlaceholder')" />
        </label>
        <div class="sm:col-span-2">
          <button type="submit" class="btn-primary" :disabled="creating || !form.quizId">{{ t('trainings.assign') }}</button>
        </div>
      </form>
    </Transition>

    <p v-if="failed" class="mt-8 rounded-2xl bg-red-50 p-4 text-center font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
      {{ t('common.error') }}
    </p>
    <ul v-else-if="!loaded" class="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden="true">
      <li v-for="i in 4" :key="i" class="card h-40 animate-pulse" />
    </ul>
    <div v-else-if="open.length === 0 && closed.length === 0" class="card mx-auto mt-12 max-w-md p-8 text-center">
      <div class="flex justify-center"><Mascot mood="cool" :size="130" /></div>
      <p class="mt-4 text-lg font-bold">{{ t('trainings.empty') }}</p>
      <p class="mt-1 text-sm text-ink-500 dark:text-ink-400">{{ isAdmin ? t('trainings.emptyAdmin') : t('trainings.emptyHint') }}</p>
    </div>

    <template v-else>
      <p v-if="todoCount > 0" class="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
        📌 {{ t('trainings.todo', { n: todoCount }) }}
      </p>
      <ul class="mt-4 grid gap-4 sm:grid-cols-2">
        <li v-for="(x, i) in [...open, ...closed]" :key="x.id" class="training card flex flex-col gap-3 p-5" :class="{ 'opacity-60': !x.active }" :style="{ animationDelay: `${i * 60}ms` }">
          <div class="flex items-start gap-3">
            <span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" :class="x.status === 'passed' ? 'bg-emerald-100 dark:bg-emerald-400/15' : 'bg-brand-100 dark:bg-brand-400/15'" aria-hidden="true">
              {{ x.status === 'passed' ? '🎓' : x.status === 'failed' ? '🔁' : '📘' }}
            </span>
            <div class="min-w-0 flex-1">
              <h2 class="font-display text-lg font-bold leading-snug">{{ x.title }}</h2>
              <p class="text-sm text-ink-500 dark:text-ink-400">
                {{ t('trainings.questions', { n: x.questionCount }) }} · {{ t('trainings.passMark', { n: x.passPercent }) }}
                <template v-if="x.department"> · {{ x.department }}</template>
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span v-if="!x.active" class="rounded-full bg-ink-200 px-3 py-1 text-ink-700 dark:bg-white/10 dark:text-ink-200">{{ t('trainings.closed') }}</span>
            <span
              class="rounded-full px-3 py-1"
              :class="{
                'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200': x.status === 'passed',
                'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200': x.status === 'failed',
                'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200': x.status === 'todo',
              }"
            >
              {{ t(`trainings.status.${x.status}`) }}<template v-if="x.bestPercent !== undefined"> · {{ x.bestPercent }}%</template>
            </span>
            <span v-if="x.dueDate" class="rounded-full px-3 py-1" :class="overdue(x) ? 'bg-red-600 text-white' : 'bg-ink-100 text-ink-700 dark:bg-white/10 dark:text-ink-200'">
              {{ overdue(x) ? t('trainings.overdue', { date: x.dueDate }) : t('trainings.due', { date: x.dueDate }) }}
            </span>
          </div>
          <div class="mt-auto flex flex-wrap gap-2 pt-1">
            <RouterLink v-if="x.active" :to="{ name: 'training', params: { id: x.id } }" class="btn-primary">
              {{ x.status === 'todo' ? t('trainings.start') : t('trainings.retake') }}
            </RouterLink>
            <RouterLink v-if="x.certificateId" :to="{ name: 'certificate', params: { id: x.certificateId } }" class="btn-secondary">
              🎓 {{ t('trainings.certificate') }}
            </RouterLink>
            <template v-if="isAdmin">
              <RouterLink :to="{ name: 'training-report', params: { id: x.id } }" class="btn-secondary">📊 {{ t('trainings.report') }}</RouterLink>
              <button type="button" class="btn-ghost" @click="toggle(x)">{{ x.active ? t('trainings.close') : t('trainings.reopen') }}</button>
            </template>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.training {
  animation: rise 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .training {
    animation: none;
  }
}
</style>
