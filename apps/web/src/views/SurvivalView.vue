<script setup lang="ts">
import { SURVIVAL, survivalSeconds, type AnswerPayload, type PlayerAnswerResult, type QuestionPublic, type SavedRound, type SurvivalQuestion } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { request } from '@/api/client';
import AnswerForm from '@/components/game/AnswerForm.vue';
import GameTimer from '@/components/game/GameTimer.vue';
import PlayerResult from '@/components/game/PlayerResult.vue';
import RevealedAnswer from '@/components/game/RevealedAnswer.vue';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';
import SoundToggles from '@/components/SoundToggles.vue';
import { useConfetti } from '@/composables/useConfetti';
import { useEmojiRain } from '@/composables/useEmojiRain';
import { serverNow } from '@/game/clock';
import { practiceAnswer, practiceQuestion, practiceResult, type PracticeItem } from '@/game/practice';
import { sound } from '@/game/sound';

/**
 * «Амьд үлдэх»: endless random questions from the whole library, three lives,
 * a clock that gets shorter, and a life back for every few right answers in a row.
 */
const { t } = useI18n();
const router = useRouter();
const confetti = useConfetti();
const { rain } = useEmojiRain();

type Stage = 'intro' | 'loading' | 'question' | 'reveal' | 'over' | 'error';
const BEST_KEY = 'agula-quiz:survival-best';

const stage = ref<Stage>('intro');
const queue = ref<SurvivalQuestion[]>([]);
const played = ref<string[]>([]);
const index = ref(0);
const lives = ref<number>(SURVIVAL.lives);
const lostLife = ref(false);
const gainedLife = ref(false);
const score = ref(0);
const streak = ref(0);
const correct = ref(0);
const best = ref(readBest());
const newBest = ref(false);
const question = ref<QuestionPublic | null>(null);
const item = ref<PracticeItem | null>(null);
const current = ref<SurvivalQuestion | null>(null);
const result = ref<PlayerAnswerResult | null>(null);
let openedAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const level = computed(() => Math.floor(index.value / SURVIVAL.levelEvery) + 1);
const overMood = computed<MascotMood>(() => (correct.value >= 20 ? 'celebrate' : correct.value >= 8 ? 'happy' : 'sad'));

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

async function refill(): Promise<void> {
  const exclude = [...played.value, ...queue.value.map((q) => q.question.id)].slice(-800);
  const batch = await request<{ questions: SurvivalQuestion[] }>(`/survival?exclude=${encodeURIComponent(exclude.join(','))}`);
  // When the library runs out, start again from the beginning.
  if (batch.questions.length === 0 && played.value.length) {
    played.value = [];
    return refill();
  }
  queue.value.push(...batch.questions);
}

async function start(): Promise<void> {
  stage.value = 'loading';
  lives.value = SURVIVAL.lives;
  index.value = 0;
  score.value = 0;
  streak.value = 0;
  correct.value = 0;
  newBest.value = false;
  queue.value = [];
  played.value = [];
  try {
    await refill();
    sound.play('whoosh');
    showQuestion();
  } catch {
    stage.value = 'error';
  }
}

function showQuestion(): void {
  const next = queue.value.shift();
  if (!next) {
    stage.value = 'error';
    return;
  }
  if (queue.value.length < 5) void refill().catch(() => undefined);
  played.value.push(next.question.id);
  current.value = next;
  const seconds = survivalSeconds(index.value);
  const round: SavedRound = {
    id: 'survival',
    name: t('survival.level', { n: level.value }),
    type: 'normal',
    timePerQuestion: seconds,
    pointsMultiplier: 1,
    shuffleQuestions: false,
    shuffleAnswers: true,
    questions: [],
  };
  // The level sets the clock, whatever the question was authored with.
  const q = { ...next.question, timeLimit: undefined };
  item.value = { round, question: q, roundIndex: level.value - 1, questionIndex: index.value, globalIndex: index.value };
  openedAt = serverNow();
  question.value = practiceQuestion(item.value, 0, openedAt + seconds * 1000, `${openedAt}`);
  result.value = null;
  lostLife.value = false;
  gainedLife.value = false;
  stage.value = 'question';
  sound.play('go');
  clearTimeout(timer);
  timer = setTimeout(() => answer(undefined), seconds * 1000);
}

function answer(payload: AnswerPayload | undefined): void {
  if (stage.value !== 'question' || !item.value) return;
  clearTimeout(timer);
  const outcome = practiceResult(item.value, payload, serverNow() - openedAt, { score: score.value, streak: streak.value });
  result.value = outcome;
  score.value = outcome.score;
  streak.value = outcome.streak;
  if (outcome.correct) {
    correct.value += 1;
    sound.play(outcome.streak >= 3 ? 'streak' : 'correct');
    confetti.burst({ count: 50, y: 0.4 });
    if (outcome.streak % SURVIVAL.lifeEvery === 0 && lives.value < SURVIVAL.maxLives) {
      lives.value += 1;
      gainedLife.value = true;
      sound.play('sparkle');
      rain(['❤️', '💖', '✨']);
    }
  } else {
    lives.value -= 1;
    lostLife.value = true;
    sound.play(payload ? 'wrong' : 'timeUp');
  }
  stage.value = 'reveal';
}

function next(): void {
  if (lives.value <= 0) {
    gameOver();
    return;
  }
  index.value += 1;
  showQuestion();
}

function gameOver(): void {
  stage.value = 'over';
  if (correct.value > best.value) {
    newBest.value = best.value > 0;
    best.value = correct.value;
    try {
      localStorage.setItem(BEST_KEY, String(correct.value));
    } catch {
      // Not saved; the run still counts on screen.
    }
  }
  sound.play('fanfare');
  if (newBest.value) confetti.celebrate();
}

function quit(): void {
  const playing = stage.value === 'question' || stage.value === 'reveal';
  if (playing && !window.confirm(t('survival.quitConfirm'))) return;
  void router.push({ name: 'home' });
}

function onKey(event: KeyboardEvent): void {
  if (stage.value === 'reveal' && (event.key === 'Enter' || event.key === 'ArrowRight')) {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)) return;
    event.preventDefault();
    next();
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  clearTimeout(timer);
});
</script>

<template>
  <div class="dark stage min-h-dvh">
    <section class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header class="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 bg-ink-950/70 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <span class="chip shrink-0 whitespace-nowrap bg-rose-500/15 px-3 py-1 text-rose-300 ring-1 ring-rose-400/30">💀 {{ t('survival.badge') }}</span>
        <span v-if="stage === 'question' || stage === 'reveal'" class="mr-auto flex items-center gap-1 text-xl" :aria-label="t('survival.livesLabel', { n: lives })" role="img">
          <span
            v-for="i in SURVIVAL.maxLives"
            :key="i"
            class="heart"
            :class="[i <= lives ? '' : 'opacity-20 grayscale', lostLife && i === lives + 1 ? 'heart-break' : '', gainedLife && i === lives ? 'heart-gain' : '']"
          >❤️</span>
        </span>
        <span v-else class="mr-auto" />
        <span v-if="stage === 'question' || stage === 'reveal'" class="rounded-full bg-brand-500 px-3 py-1 font-display font-bold tabular-nums text-ink-950" aria-live="polite">
          <span class="sr-only">{{ t('game.player.score') }}: </span>{{ score }}
        </span>
        <SoundToggles />
        <button type="button" class="btn-icon" :aria-label="t('practice.quit')" @click="quit">✕</button>
      </header>

      <Transition name="phase" mode="out-in">
        <!-- Intro -->
        <div v-if="stage === 'intro'" key="intro" class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div class="relative">
            <Mascot mood="cool" :size="150" />
            <span class="absolute -right-8 bottom-4 text-5xl drop-shadow-lg" aria-hidden="true">💀</span>
          </div>
          <div>
            <h1 class="font-display text-4xl font-bold">{{ t('survival.title') }}</h1>
            <p class="mt-3 text-lg font-semibold text-slate-300">{{ t('survival.intro') }}</p>
          </div>
          <ul class="w-full space-y-2 text-left text-base text-slate-300">
            <li>❤️ {{ t('survival.ruleLives', { n: SURVIVAL.lives }) }}</li>
            <li>💖 {{ t('survival.ruleHeal', { n: SURVIVAL.lifeEvery }) }}</li>
            <li>⏱️ {{ t('survival.ruleClock', { from: SURVIVAL.startSeconds, to: SURVIVAL.minSeconds }) }}</li>
            <li>🎲 {{ t('survival.ruleMix') }}</li>
          </ul>
          <div class="card w-full p-4 text-left">
            <p class="text-sm font-bold text-slate-400">{{ t('survival.best') }}</p>
            <p class="font-display text-3xl font-bold">{{ best || '—' }}</p>
          </div>
          <button type="button" class="btn-primary w-full py-4 text-lg" @click="start">▶ {{ t('survival.start') }}</button>
        </div>

        <div v-else-if="stage === 'loading'" key="loading" class="flex flex-1 flex-col items-center justify-center gap-4" role="status">
          <Mascot mood="thinking" :size="120" />
          <p class="font-bold text-slate-300">{{ t('survival.loading') }}</p>
        </div>

        <div v-else-if="stage === 'error'" key="error" class="card mt-10 flex flex-col items-center p-8 text-center" role="alert">
          <Mascot mood="sad" :size="120" />
          <p class="mt-4 text-lg font-bold">{{ t('common.error') }}</p>
          <button type="button" class="btn-primary mt-6" @click="start">↻ {{ t('survival.again') }}</button>
        </div>

        <div v-else-if="stage === 'question' && question && current" :key="`q${index}`" class="flex flex-1 flex-col gap-4">
          <div class="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span class="rounded-full bg-white/10 px-3 py-1">{{ t('survival.level', { n: level }) }}</span>
            <span class="rounded-full bg-white/10 px-3 py-1">#{{ index + 1 }}</span>
            <span class="truncate text-slate-400">{{ current.quizTitle }}</span>
          </div>
          <div class="flex items-center gap-3">
            <h2 class="flex-1 text-xl font-bold leading-snug">{{ question.prompt }}</h2>
            <GameTimer :ends-at="question.endsAt" :total="question.timeLimit" />
          </div>
          <img v-if="question.imageUrl" :src="question.imageUrl" alt="" class="max-h-48 self-center rounded-xl object-contain" />
          <AnswerForm :question="question" @submit="answer" />
        </div>

        <div v-else-if="stage === 'reveal' && result && question && item" :key="`r${index}`" class="flex flex-1 flex-col justify-center gap-5">
          <p v-if="gainedLife" class="mx-auto animate-pop rounded-full bg-pink-500 px-4 py-1.5 font-extrabold">💖 {{ t('survival.lifeBack') }}</p>
          <p v-else-if="lostLife && lives > 0" class="mx-auto animate-pop rounded-full bg-rose-600 px-4 py-1.5 font-extrabold">💔 {{ t('survival.lifeLost', { n: lives }) }}</p>
          <PlayerResult :result="result" :seed="index" solo />
          <RevealedAnswer :question="question" :answer="practiceAnswer(item.question)" />
          <p v-if="item.question.explanation" class="rounded-2xl bg-sky-500/10 p-4 text-sky-100 ring-1 ring-sky-400/20">
            <span aria-hidden="true">💡</span> {{ item.question.explanation }}
          </p>
          <button type="button" class="btn-primary w-full py-4 text-lg" autofocus @click="next">
            {{ lives > 0 ? t('game.controls.nextQuestion') : t('survival.seeResult') }} →
          </button>
        </div>

        <!-- Game over -->
        <div v-else-if="stage === 'over'" key="over" class="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <Mascot :mood="overMood" :size="150" />
          <div>
            <p class="font-display text-lg font-bold uppercase tracking-widest text-rose-300">{{ t('survival.over') }}</p>
            <p class="font-display text-7xl font-bold tabular-nums">{{ correct }}</p>
            <p class="text-lg font-semibold text-slate-300">{{ t('survival.survived') }}</p>
            <p v-if="newBest" class="mt-3 inline-block animate-pop rounded-full bg-amber-400 px-4 py-1.5 font-extrabold text-ink-950">🏆 {{ t('practice.newBest') }}</p>
          </div>
          <dl class="grid w-full grid-cols-3 gap-3">
            <div class="card p-4">
              <dt class="text-sm font-bold text-slate-400">{{ t('game.podium.score') }}</dt>
              <dd class="font-display text-2xl font-bold tabular-nums">{{ score }}</dd>
            </div>
            <div class="card p-4">
              <dt class="text-sm font-bold text-slate-400">{{ t('survival.levelReached') }}</dt>
              <dd class="font-display text-2xl font-bold">{{ level }}</dd>
            </div>
            <div class="card p-4">
              <dt class="text-sm font-bold text-slate-400">{{ t('survival.best') }}</dt>
              <dd class="font-display text-2xl font-bold">{{ best }}</dd>
            </div>
          </dl>
          <div class="flex w-full flex-col gap-3">
            <button type="button" class="btn-primary w-full py-4 text-lg" @click="start">↻ {{ t('survival.again') }}</button>
            <RouterLink to="/" class="btn-secondary w-full">{{ t('survival.home') }}</RouterLink>
          </div>
        </div>
      </Transition>
    </section>
  </div>
</template>

<style scoped>
.heart {
  display: inline-block;
  transition: opacity 0.3s, filter 0.3s;
}
.heart-break {
  animation: heart-break 0.7s ease both;
}
.heart-gain {
  animation: heart-gain 0.8s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
@keyframes heart-break {
  0% {
    transform: scale(1.4);
    opacity: 1;
    filter: none;
  }
  40% {
    transform: scale(1.2) rotate(-15deg);
  }
  100% {
    transform: scale(1) rotate(0);
  }
}
@keyframes heart-gain {
  from {
    transform: scale(0) rotate(-30deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .heart-break,
  .heart-gain {
    animation: none;
  }
}
</style>
