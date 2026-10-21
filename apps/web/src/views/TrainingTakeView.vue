<script setup lang="ts">
import type { AnswerPayload, QuestionPublic, TrainingAttemptResult, TrainingDetail, TrainingQuestion } from '@quiz/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiError } from '@/api/client';
import { trainingsApi } from '@/api/trainings';
import AnswerForm from '@/components/game/AnswerForm.vue';
import Mascot from '@/components/Mascot.vue';
import { useConfetti } from '@/composables/useConfetti';
import { sound } from '@/game/sound';

/** Taking a training: one question at a time, no clock, graded by the server at the end. */
const props = defineProps<{ id: string }>();
const { t } = useI18n();
const confetti = useConfetti();

const training = ref<TrainingDetail | null>(null);
const failed = ref<'missing' | 'error' | null>(null);
const stage = ref<'intro' | 'question' | 'sending' | 'result'>('intro');
const index = ref(0);
const answers = ref(new Map<string, AnswerPayload>());
const result = ref<TrainingAttemptResult | null>(null);

const questions = computed(() => training.value?.questions ?? []);
const current = computed(() => questions.value[index.value]);
const progress = computed(() => (questions.value.length ? (index.value / questions.value.length) * 100 : 0));

/** The phone answer form expects a live-game question; give it one. */
function asPublic(q: TrainingQuestion, i: number): QuestionPublic {
  return {
    roundIndex: 0,
    roundName: '',
    roundType: 'normal',
    questionIndex: i,
    roundQuestionCount: questions.value.length,
    globalIndex: i,
    totalQuestions: questions.value.length,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    points: 0,
    timeLimit: 0,
    endsAt: 0,
    type: q.type,
    // The form picks its layout by which fields exist, so only send the ones this type has.
    ...(q.options ? { options: q.options, correctCount: q.correctCount ?? 1 } : {}),
    ...(q.items ? { items: q.items } : {}),
  } as unknown as QuestionPublic;
}

async function load(): Promise<void> {
  try {
    training.value = await trainingsApi.get(props.id);
  } catch (e) {
    failed.value = e instanceof ApiError && e.status === 404 ? 'missing' : 'error';
  }
}

function start(): void {
  answers.value = new Map();
  index.value = 0;
  result.value = null;
  stage.value = 'question';
  sound.play('go');
}

function answer(payload: AnswerPayload): void {
  const q = current.value;
  if (!q) return;
  answers.value.set(q.id, payload);
  sound.play('answer');
  if (index.value < questions.value.length - 1) index.value += 1;
  else void submit();
}

async function submit(): Promise<void> {
  stage.value = 'sending';
  try {
    const res = await trainingsApi.submit(props.id, {
      answers: [...answers.value.entries()].map(([questionId, answer]) => ({ questionId, answer })),
    });
    // A beat of suspense before the verdict.
    await new Promise((r) => setTimeout(r, 900));
    result.value = res;
    stage.value = 'result';
    if (res.passed) {
      sound.play('fanfare');
      confetti.celebrate();
    } else {
      sound.play('wrong');
    }
  } catch {
    stage.value = 'question';
    failed.value = 'error';
  }
}

const reviewed = computed(() =>
  (result.value?.review ?? []).map((r) => ({ ...r, prompt: questions.value.find((q) => q.id === r.questionId)?.prompt ?? '' })),
);

onMounted(load);
</script>

<template>
  <section class="mx-auto max-w-2xl px-4 py-8">
    <RouterLink to="/trainings" class="text-sm font-bold text-brand-600 hover:underline dark:text-brand-300">← {{ t('trainings.title') }}</RouterLink>

    <div v-if="failed === 'missing'" class="card mt-6 p-8 text-center">
      <div class="flex justify-center"><Mascot mood="dizzy" :size="120" /></div>
      <p class="mt-4 text-lg font-bold">{{ t('trainings.missing') }}</p>
    </div>
    <p v-else-if="failed === 'error'" class="mt-6 rounded-2xl bg-red-50 p-4 text-center font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
      {{ t('common.error') }}
    </p>
    <div v-else-if="!training" class="card mt-6 h-64 animate-pulse" aria-hidden="true" />

    <!-- Intro -->
    <div v-else-if="stage === 'intro'" class="card mt-6 flex flex-col items-center gap-4 p-8 text-center">
      <Mascot mood="wave" :size="140" :say="t('trainings.introSay')" />
      <h1 class="font-display text-3xl font-bold">{{ training.title }}</h1>
      <p class="text-ink-600 dark:text-ink-300">{{ t('trainings.intro', { n: training.questions.length, pass: training.passPercent }) }}</p>
      <p v-if="training.bestPercent !== undefined" class="font-bold">{{ t('trainings.best', { n: training.bestPercent }) }}</p>
      <button type="button" class="btn-primary px-10 py-3 text-lg" @click="start">
        {{ training.status === 'todo' ? t('trainings.start') : t('trainings.retake') }} →
      </button>
    </div>

    <!-- Questions -->
    <div v-else-if="stage === 'question' && current" class="mt-6 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <span class="text-sm font-bold text-ink-500 dark:text-ink-400">{{ t('trainings.questionOf', { n: index + 1, total: questions.length }) }}</span>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
          <div class="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-400 transition-[width] duration-500" :style="{ width: `${progress}%` }" />
        </div>
      </div>
      <Transition name="slide" mode="out-in">
        <div :key="current.id" class="dark stage flex flex-col gap-4 rounded-3xl p-5">
          <h2 class="text-xl font-bold leading-snug text-white">{{ current.prompt }}</h2>
          <img v-if="current.imageUrl" :src="current.imageUrl" alt="" class="max-h-48 self-center rounded-xl object-contain" />
          <AnswerForm :question="asPublic(current, index)" @submit="answer" />
        </div>
      </Transition>
    </div>

    <!-- Grading -->
    <div v-else-if="stage === 'sending'" class="card mt-6 flex flex-col items-center gap-4 p-10 text-center" role="status">
      <Mascot mood="thinking" :size="140" />
      <p class="text-lg font-bold">{{ t('trainings.grading') }}</p>
    </div>

    <!-- Result -->
    <div v-else-if="stage === 'result' && result" class="mt-6 flex flex-col gap-5">
      <div
        class="verdict flex flex-col items-center gap-3 rounded-3xl p-8 text-center text-white shadow-xl"
        :class="result.passed ? 'bg-gradient-to-br from-emerald-500 to-teal-700' : 'bg-gradient-to-br from-rose-500 to-pink-700'"
        role="status"
      >
        <Mascot :mood="result.passed ? 'celebrate' : 'sad'" :size="130" />
        <p class="font-display text-6xl font-bold tabular-nums">{{ result.percent }}%</p>
        <p class="text-2xl font-bold">{{ result.passed ? t('trainings.passed') : t('trainings.notPassed', { n: result.passPercent }) }}</p>
        <p class="text-white/85">{{ t('trainings.score', { correct: result.correct, total: result.total }) }}</p>
        <div class="mt-2 flex flex-wrap justify-center gap-2">
          <RouterLink v-if="result.certificateId" :to="{ name: 'certificate', params: { id: result.certificateId } }" class="btn-secondary">
            🎓 {{ t('trainings.certificate') }}
          </RouterLink>
          <button v-if="!result.passed" type="button" class="btn-secondary" @click="start">🔁 {{ t('trainings.retake') }}</button>
        </div>
      </div>

      <section class="card p-5">
        <h2 class="font-display text-lg font-bold">{{ t('trainings.review') }}</h2>
        <ol class="mt-3 grid gap-2">
          <li v-for="(r, i) in reviewed" :key="r.questionId" class="rounded-2xl p-3" :class="r.correct ? 'bg-emerald-50 dark:bg-emerald-400/10' : 'bg-rose-50 dark:bg-rose-400/10'">
            <p class="font-bold"><span aria-hidden="true">{{ r.correct ? '✅' : '❌' }}</span> {{ i + 1 }}. {{ r.prompt }}</p>
            <p v-if="r.explanation" class="mt-1 text-sm text-ink-600 dark:text-ink-300">💡 {{ r.explanation }}</p>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.28s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}
.verdict {
  animation: verdict-in 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
@keyframes verdict-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}
@media (prefers-reduced-motion: reduce) {
  .verdict {
    animation: none;
  }
}
</style>
