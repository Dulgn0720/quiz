<script setup lang="ts">
import { GAME_TIMINGS, type AnswerPayload, type PhasePayload, type PlayerAnswerResult, type QuestionPublic, type QuizDetail } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { quizzesApi } from '@/api/quizzes';
import { shortTitle, quizTheme } from '@/brand/topics';
import AnswerForm from '@/components/game/AnswerForm.vue';
import CountdownCard from '@/components/game/CountdownCard.vue';
import GameTimer from '@/components/game/GameTimer.vue';
import PlayerResult from '@/components/game/PlayerResult.vue';
import QuestionHeader from '@/components/game/QuestionHeader.vue';
import RevealedAnswer from '@/components/game/RevealedAnswer.vue';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';
import SoundToggles from '@/components/SoundToggles.vue';
import { useConfetti } from '@/composables/useConfetti';
import { serverNow } from '@/game/clock';
import {
  practiceAnswer,
  practiceItems,
  practiceQuestion,
  practiceResult,
  practiceStars,
  practiceTimeLimit,
  readPracticeBest,
  savePracticeBest,
  type PracticeBest,
  type PracticeItem,
} from '@/game/practice';
import { sound } from '@/game/sound';

/** Solo practice of a quiz on one device: same questions, timer and scoring as a live game. */
const props = defineProps<{ id: string }>();

const { t } = useI18n();
const router = useRouter();
const confetti = useConfetti();

type Stage = 'loading' | 'error' | 'intro' | 'countdown' | 'question' | 'reveal' | 'done';
type Countdown = Extract<PhasePayload, { phase: 'countdown' }>;

const quiz = ref<QuizDetail | null>(null);
const stage = ref<Stage>('loading');
const items = ref<PracticeItem[]>([]);
const index = ref(0);
const seed = ref('');
const countdown = ref<Countdown | null>(null);
const question = ref<QuestionPublic | null>(null);
const result = ref<PlayerAnswerResult | null>(null);
const score = ref(0);
const streak = ref(0);
const bestStreak = ref(0);
const correctCount = ref(0);
const best = ref<PracticeBest | null>(null);
const newBest = ref(false);
let openedAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const item = computed(() => items.value[index.value]);
const total = computed(() => items.value.length);
const stars = computed(() => practiceStars(correctCount.value, total.value));
const isLast = computed(() => index.value >= total.value - 1);

const doneMood = computed<MascotMood>(() => (['sad', 'thinking', 'happy', 'celebrate'] as const)[stars.value]!);

onMounted(async () => {
  try {
    quiz.value = await quizzesApi.get(props.id);
    best.value = readPracticeBest(props.id);
    stage.value = quiz.value.rounds.some((r) => r.questions.length) ? 'intro' : 'error';
  } catch {
    stage.value = 'error';
  }
});
onBeforeUnmount(() => clearTimeout(timer));

function start(): void {
  if (!quiz.value) return;
  seed.value = Math.random().toString(36).slice(2);
  items.value = practiceItems(quiz.value, seed.value);
  index.value = 0;
  score.value = 0;
  streak.value = 0;
  bestStreak.value = 0;
  correctCount.value = 0;
  newBest.value = false;
  showCountdown();
}

function showCountdown(): void {
  const current = item.value!;
  const roundStart = current.questionIndex === 0;
  countdown.value = {
    phase: 'countdown',
    endsAt: serverNow() + GAME_TIMINGS.countdownMs,
    roundIndex: current.roundIndex,
    roundName: current.round.name,
    roundType: current.round.type === 'elimination' ? 'normal' : current.round.type,
    roundStart,
    globalIndex: current.globalIndex,
    totalQuestions: total.value,
  };
  stage.value = 'countdown';
  if (roundStart) sound.play('whoosh');
  clearTimeout(timer);
  timer = setTimeout(showQuestion, GAME_TIMINGS.countdownMs);
}

function showQuestion(): void {
  const current = item.value!;
  const limitMs = practiceTimeLimit(current) * 1000;
  openedAt = serverNow();
  question.value = practiceQuestion(current, total.value, openedAt + limitMs, seed.value);
  result.value = null;
  stage.value = 'question';
  sound.play('go');
  clearTimeout(timer);
  timer = setTimeout(() => finishQuestion(undefined), limitMs);
}

function finishQuestion(answer: AnswerPayload | undefined): void {
  if (stage.value !== 'question') return;
  clearTimeout(timer);
  const current = item.value!;
  const outcome = practiceResult(current, answer, serverNow() - openedAt, { score: score.value, streak: streak.value });
  result.value = outcome;
  score.value = outcome.score;
  streak.value = outcome.streak;
  bestStreak.value = Math.max(bestStreak.value, outcome.streak);
  if (outcome.correct) {
    correctCount.value += 1;
    sound.play(outcome.streak >= 3 ? 'streak' : 'correct');
    confetti.burst({ count: 60, y: 0.4 });
  } else {
    sound.play(answer ? 'wrong' : 'timeUp');
  }
  stage.value = 'reveal';
}

function next(): void {
  if (isLast.value) {
    finish();
    return;
  }
  index.value += 1;
  showCountdown();
}

function finish(): void {
  stage.value = 'done';
  newBest.value = savePracticeBest(props.id, { score: score.value, correct: correctCount.value, total: total.value });
  if (newBest.value) best.value = { score: score.value, correct: correctCount.value, total: total.value };
  sound.play('fanfare');
  if (stars.value >= 2) confetti.celebrate();
}

function quit(): void {
  const playing = stage.value !== 'intro' && stage.value !== 'done' && stage.value !== 'error';
  if (playing && !window.confirm(t('practice.quitConfirm'))) return;
  void router.push({ name: 'quizzes' });
}

function onKey(event: KeyboardEvent): void {
  if (stage.value === 'reveal' && (event.key === 'Enter' || event.key === 'ArrowRight')) {
    const target = event.target as HTMLElement | null;
    // Buttons already react to Enter themselves.
    if (target && ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)) return;
    event.preventDefault();
    next();
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="dark stage min-h-dvh">
    <section class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header class="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 bg-ink-950/70 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <span class="chip shrink-0 whitespace-nowrap bg-brand-500/15 px-3 py-1 text-brand-300 ring-1 ring-brand-400/30">🎯 {{ t('practice.badge') }}</span>
        <span class="mr-auto truncate font-bold">{{ quiz ? shortTitle(quiz.title) : '' }}</span>
        <span
          v-if="stage !== 'intro' && stage !== 'loading' && stage !== 'error'"
          class="rounded-full bg-brand-500 px-3 py-1 font-display font-bold tabular-nums text-ink-950"
          aria-live="polite"
        >
          <span class="sr-only">{{ t('game.player.score') }}: </span>{{ score }}
        </span>
        <SoundToggles />
        <button type="button" class="btn-icon" :aria-label="t('practice.quit')" @click="quit">✕</button>
      </header>

      <p v-if="stage === 'loading'" class="mt-16 text-center text-slate-400">{{ t('common.loading') }}</p>

      <div v-else-if="stage === 'error'" class="card mt-10 flex flex-col items-center p-8 text-center" role="alert">
        <Mascot mood="sad" :size="120" />
        <p class="mt-4 text-lg font-bold">{{ t('practice.loadError') }}</p>
        <RouterLink to="/quizzes" class="btn-primary mt-6">{{ t('game.podium.backToQuizzes') }}</RouterLink>
      </div>

      <Transition v-else name="phase" mode="out-in">
        <!-- Intro -->
        <div v-if="stage === 'intro' && quiz" key="intro" class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div class="relative">
            <Mascot mood="wave" :size="150" />
            <span class="absolute -right-6 bottom-4 text-5xl drop-shadow-lg" aria-hidden="true">{{ quizTheme(quiz.title).icon }}</span>
          </div>
          <div>
            <h1 class="text-3xl font-bold">{{ shortTitle(quiz.title) }}</h1>
            <p class="mt-3 text-lg font-semibold text-slate-300">{{ t('practice.intro') }}</p>
          </div>
          <ul class="grid w-full grid-cols-2 gap-3 text-left">
            <li class="card p-4">
              <p class="text-sm font-bold text-slate-400">{{ t('practice.questions') }}</p>
              <p class="font-display text-3xl font-bold">{{ quiz.rounds.reduce((n, r) => n + r.questions.length, 0) }}</p>
            </li>
            <li class="card p-4">
              <p class="text-sm font-bold text-slate-400">{{ t('practice.best') }}</p>
              <p class="font-display text-3xl font-bold">{{ best ? best.score : '—' }}</p>
            </li>
          </ul>
          <ul class="w-full space-y-2 text-left text-base text-slate-300">
            <li>⚡ {{ t('practice.ruleSpeed') }}</li>
            <li>🔥 {{ t('practice.ruleStreak') }}</li>
            <li>💡 {{ t('practice.ruleExplain') }}</li>
          </ul>
          <button type="button" class="btn-primary w-full py-4 text-lg" @click="start">▶ {{ t('practice.start') }}</button>
        </div>

        <CountdownCard v-else-if="stage === 'countdown' && countdown" :key="`c${index}`" :countdown="countdown" />

        <div v-else-if="stage === 'question' && question" :key="`q${index}`" class="flex flex-1 flex-col gap-4">
          <QuestionHeader :question="question" />
          <div class="flex items-center gap-3">
            <h2 class="flex-1 text-xl font-bold leading-snug">{{ question.prompt }}</h2>
            <GameTimer :ends-at="question.endsAt" :total="question.timeLimit" />
          </div>
          <img v-if="question.imageUrl" :src="question.imageUrl" alt="" class="max-h-48 self-center rounded-xl object-contain" />
          <AnswerForm :question="question" @submit="finishQuestion" />
        </div>

        <div v-else-if="stage === 'reveal' && result && question && item" :key="`r${index}`" class="flex flex-1 flex-col justify-center gap-6">
          <PlayerResult :result="result" :seed="index" solo />
          <RevealedAnswer :question="question" :answer="practiceAnswer(item.question)" />
          <p v-if="item.question.explanation" class="rounded-2xl bg-sky-500/10 p-4 text-sky-100 ring-1 ring-sky-400/20">
            <span aria-hidden="true">💡</span> {{ item.question.explanation }}
          </p>
          <button type="button" class="btn-primary w-full py-4 text-lg" autofocus @click="next">
            {{ isLast ? t('practice.seeResult') : t('game.controls.nextQuestion') }} →
          </button>
        </div>

        <!-- Summary -->
        <div v-else-if="stage === 'done'" key="done" class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Mascot :mood="doneMood" :size="150" />
          <div class="flex gap-2 text-5xl" :aria-label="t('practice.starsLabel', { n: stars })" role="img">
            <span v-for="i in 3" :key="i" class="star" :class="i <= stars ? '' : 'opacity-20 grayscale'" :style="{ animationDelay: `${i * 0.25}s` }">⭐</span>
          </div>
          <div>
            <h1 class="text-3xl font-bold">{{ t(`practice.verdict.${stars}`) }}</h1>
            <p v-if="newBest" class="mt-3 inline-block animate-pop rounded-full bg-amber-400 px-4 py-1.5 font-extrabold text-ink-950">
              🏆 {{ t('practice.newBest') }}
            </p>
          </div>
          <dl class="grid w-full grid-cols-3 gap-3">
            <div class="card p-4">
              <dt class="text-sm font-bold text-slate-400">{{ t('game.podium.score') }}</dt>
              <dd class="font-display text-2xl font-bold tabular-nums">{{ score }}</dd>
            </div>
            <div class="card p-4">
              <dt class="text-sm font-bold text-slate-400">{{ t('game.podium.correct') }}</dt>
              <dd class="font-display text-2xl font-bold">{{ correctCount }}/{{ total }}</dd>
            </div>
            <div class="card p-4">
              <dt class="text-sm font-bold text-slate-400">{{ t('practice.streak') }}</dt>
              <dd class="font-display text-2xl font-bold">🔥 {{ bestStreak }}</dd>
            </div>
          </dl>
          <p v-if="best && !newBest" class="font-semibold text-slate-400">{{ t('practice.bestWas', { score: best.score }) }}</p>
          <div class="flex w-full flex-col gap-3">
            <button type="button" class="btn-primary w-full py-4 text-lg" @click="start">↻ {{ t('practice.again') }}</button>
            <RouterLink to="/quizzes" class="btn-secondary w-full">{{ t('game.podium.backToQuizzes') }}</RouterLink>
          </div>
        </div>
      </Transition>
    </section>
  </div>
</template>

<style scoped>
.star {
  display: inline-block;
  animation: star-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes star-in {
  from {
    transform: scale(0) rotate(-90deg);
    opacity: 0;
  }
  to {
    transform: scale(1) rotate(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .star {
    animation: none;
  }
}
</style>
