<script setup lang="ts">
import { rankForLevel, type DailyQuestion, type DailyResult, type DailyStreak } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { dailyApi } from '@/api/daily';
import { ApiError } from '@/api/client';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';
import RankUpCelebration from '@/components/RankUpCelebration.vue';
import { useConfetti } from '@/composables/useConfetti';
import { useEmojiRain } from '@/composables/useEmojiRain';
import { guestDaily, saveGuestDaily } from '@/game/guest-daily';
import { sound } from '@/game/sound';
import { useAuthStore } from '@/stores/auth';

/** «Өдрийн асуулт» on the home page: one question a day and a streak of days in a row. */
const { t } = useI18n();
const auth = useAuthStore();
const confetti = useConfetti();
const { rain } = useEmojiRain();

const question = ref<DailyQuestion | null>(null);
const result = ref<DailyResult | null>(null);
const streak = ref<DailyStreak | null>(null);
const busy = ref(false);
const failed = ref(false);
/** Set right after answering, to play the reveal animations once. */
const justAnswered = ref(false);
const now = ref(Date.now());
const rankUpLevel = ref<number | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

const choices = computed(() => {
  const q = question.value;
  if (!q) return [];
  if (q.type === 'true_false') {
    return [
      { id: 'true', text: t('daily.true'), icon: '✔' },
      { id: 'false', text: t('daily.false'), icon: '✘' },
    ];
  }
  return (q.options ?? []).map((o, i) => ({ id: o.id, text: o.text, icon: ['▲', '◆', '●', '■', '★', '⬟'][i] ?? '•' }));
});

const mood = computed<MascotMood>(() => {
  if (busy.value) return 'thinking';
  if (!result.value) return 'wave';
  if (result.value.correct) return justAnswered.value ? 'celebrate' : 'cool';
  return 'sad';
});

const speech = computed(() => {
  if (!question.value) return '';
  if (!result.value) return t('daily.prompt');
  if (result.value.correct) return t(streak.value && streak.value.current >= 3 ? 'daily.correctStreak' : 'daily.correct', { n: streak.value?.current ?? 1 });
  return t('daily.wrong');
});

/** Time left until the next question (midnight in Ulaanbaatar). */
const nextIn = computed(() => {
  if (!question.value) return '';
  const next = Date.parse(`${question.value.day}T00:00:00+08:00`) + 86_400_000;
  const left = Math.max(0, Math.floor((next - now.value) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
});

function choiceState(id: string): 'idle' | 'right' | 'wrong' | 'dim' {
  const r = result.value;
  if (!r) return 'idle';
  if (id === r.correctAnswer) return 'right';
  if (id === r.answer) return 'wrong';
  return 'dim';
}

async function load(): Promise<void> {
  failed.value = false;
  try {
    const q = await dailyApi.today();
    question.value = q;
    justAnswered.value = false;
    if (auth.user) {
      result.value = q.result ?? null;
      streak.value = q.streak ?? null;
    } else {
      const guest = guestDaily(q.day);
      result.value = guest.result ?? null;
      streak.value = guest.streak;
    }
  } catch {
    failed.value = true;
  }
}

async function answer(id: string): Promise<void> {
  if (busy.value || result.value || !question.value) return;
  const day = question.value.day;
  busy.value = true;
  sound.play('answer');
  try {
    const res = await dailyApi.answer(id);
    // A short beat of suspense before the reveal.
    await new Promise((r) => setTimeout(r, 700));
    justAnswered.value = true;
    result.value = res.result;
    streak.value = auth.user ? (res.streak ?? null) : saveGuestDaily(day, res.result);
    if (res.result.correct) {
      sound.play((streak.value?.current ?? 0) >= 3 ? 'streak' : 'correct');
      confetti.burst({ count: 90, y: 0.45 });
      if ((streak.value?.current ?? 0) >= 3) rain(['🔥', '⭐', '🔥']);
    } else {
      sound.play('wrong');
    }
    if (auth.user && res.result.xp > 0) void refreshLevel(auth.user.level);
  } catch (e) {
    // The day changed under us, or the network dropped: fetch today's question again.
    if (e instanceof ApiError && e.status === 400) await load();
    else failed.value = true;
  } finally {
    busy.value = false;
  }
}

/** Daily XP can be the push to a new title: celebrate it like after a game. */
async function refreshLevel(before: number): Promise<void> {
  try {
    const profile = await auth.refresh();
    if (rankForLevel(profile.level).code !== rankForLevel(before).code) rankUpLevel.value = profile.level;
  } catch {
    // The header catches up on the next page load.
  }
}

onMounted(() => {
  void load();
  timer = setInterval(() => {
    now.value = Date.now();
    if (question.value && nextIn.value === '00:00:00') void load();
  }, 1000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section class="daily card relative overflow-hidden p-5 sm:p-7" :aria-label="t('daily.title')">
    <div class="daily-glow" aria-hidden="true" />
    <div class="relative flex flex-wrap items-center gap-3">
      <h2 class="mr-auto flex items-center gap-2 font-display text-xl font-bold sm:text-2xl">
        <span class="daily-cal" aria-hidden="true">📅</span> {{ t('daily.title') }}
      </h2>
      <span
        v-if="streak"
        :key="streak.current"
        class="streak-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold"
        :class="streak.current > 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-ink-950 shadow-glow' : 'bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-300'"
        :title="t('daily.best', { n: streak.best })"
      >
        <span :class="streak.current > 0 ? 'flame' : 'grayscale'" aria-hidden="true">🔥</span>
        {{ streak.current > 0 ? t('daily.streak', { n: streak.current }) : t('daily.startStreak') }}
      </span>
    </div>

    <p v-if="failed" class="relative mt-4 text-ink-500">{{ t('daily.unavailable') }}</p>
    <div v-else-if="!question" class="relative mt-5 grid gap-3" aria-hidden="true">
      <div class="h-6 w-3/4 animate-pulse rounded-lg bg-ink-100 dark:bg-white/10" />
      <div class="grid grid-cols-2 gap-2">
        <div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-2xl bg-ink-100 dark:bg-white/10" />
      </div>
    </div>

    <div v-else class="relative mt-4 grid items-start gap-5 md:grid-cols-[1fr_auto]">
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">{{ question.quizTitle }}</p>
        <p class="mt-1 text-lg font-bold leading-snug sm:text-xl">{{ question.prompt }}</p>
        <img v-if="question.imageUrl" :src="question.imageUrl" alt="" class="mt-3 max-h-48 rounded-2xl object-contain" />

        <div class="mt-4 grid gap-2" :class="question.type === 'true_false' ? 'grid-cols-2' : 'sm:grid-cols-2'">
          <button
            v-for="(c, i) in choices"
            :key="c.id"
            type="button"
            class="choice flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left font-bold ring-1 transition duration-200 focus-visible:outline-none focus-visible:ring-4"
            :class="[`choice-${choiceState(c.id)}`, justAnswered ? 'animate' : '']"
            :style="{ animationDelay: `${i * 60}ms` }"
            :disabled="busy || !!result"
            :aria-pressed="result?.answer === c.id"
            @click="answer(c.id)"
          >
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/10 text-sm dark:bg-white/10" aria-hidden="true">{{ c.icon }}</span>
            <span class="min-w-0 flex-1">{{ c.text }}</span>
            <span v-if="choiceState(c.id) === 'right'" class="text-xl" aria-hidden="true">✅</span>
            <span v-else-if="choiceState(c.id) === 'wrong'" class="text-xl" aria-hidden="true">❌</span>
          </button>
        </div>

        <Transition name="daily-reveal">
          <div v-if="result" class="mt-4 grid gap-2">
            <p class="font-extrabold" :class="result.correct ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'">
              {{ result.correct ? t('daily.youGotIt') : t('daily.notThisTime') }}
              <span v-if="result.xp > 0" class="xp-pop ml-2 inline-block rounded-full bg-brand-500 px-2.5 py-0.5 text-sm text-white">+{{ result.xp }} XP</span>
            </p>
            <p v-if="result.explanation" class="rounded-2xl bg-ink-50 p-3 text-sm text-ink-700 dark:bg-white/5 dark:text-ink-200">
              💡 {{ result.explanation }}
            </p>
            <p class="text-sm text-ink-500 dark:text-ink-400">
              ⏳ {{ t('daily.next') }} <span class="font-bold tabular-nums">{{ nextIn }}</span>
              <template v-if="!auth.user"> · <RouterLink :to="{ name: 'login', query: { redirect: '/' } }" class="font-bold text-brand-600 underline dark:text-brand-300">{{ t('daily.signInHint') }}</RouterLink></template>
            </p>
          </div>
        </Transition>
      </div>

      <div class="hidden justify-center md:flex">
        <Mascot :mood="mood" :size="130" :say="speech" />
      </div>
    </div>
    <RankUpCelebration v-if="rankUpLevel !== null" :level="rankUpLevel" @close="rankUpLevel = null" />
  </section>
</template>

<style scoped>
.daily-glow {
  position: absolute;
  inset: -40% -10% auto auto;
  width: 22rem;
  height: 22rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgb(245 124 20 / 0.18), transparent 65%);
  animation: glow-drift 9s ease-in-out infinite alternate;
  pointer-events: none;
}
.daily-cal {
  display: inline-block;
  animation: cal-flip 6s ease-in-out infinite;
}
.choice-idle {
  background: rgb(255 255 255 / 0.6);
  --tw-ring-color: rgb(148 163 184 / 0.35);
}
:global(.dark) .choice-idle {
  background: rgb(255 255 255 / 0.05);
  --tw-ring-color: rgb(255 255 255 / 0.1);
}
.choice-idle:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -12px rgb(245 124 20 / 0.6);
  --tw-ring-color: rgb(245 124 20 / 0.7);
}
.choice-idle:disabled {
  opacity: 0.7;
}
.choice-right {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  --tw-ring-color: #6ee7b7;
}
.choice-right.animate {
  animation: right-bounce 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.choice-wrong {
  background: linear-gradient(135deg, #f43f5e, #e11d48);
  color: white;
  --tw-ring-color: #fda4af;
}
.choice-wrong.animate {
  animation: wrong-shake 0.5s ease both;
}
.choice-dim {
  opacity: 0.45;
  --tw-ring-color: transparent;
}
.choice-dim.animate {
  animation: dim-in 0.4s ease both;
}
.streak-badge {
  animation: badge-pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
.flame {
  display: inline-block;
  animation: flame 1.2s ease-in-out infinite;
  transform-origin: 50% 90%;
}
.xp-pop {
  animation: xp-pop 0.8s cubic-bezier(0.2, 1.5, 0.4, 1) both;
}
.daily-reveal-enter-active {
  transition: all 0.4s ease 0.15s;
}
.daily-reveal-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
@keyframes glow-drift {
  to {
    transform: translate(-3rem, 2rem) scale(1.15);
  }
}
@keyframes cal-flip {
  0%,
  85%,
  100% {
    transform: rotateY(0);
  }
  92% {
    transform: rotateY(180deg);
  }
}
@keyframes right-bounce {
  0% {
    transform: scale(0.94);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes wrong-shake {
  20%,
  60% {
    transform: translateX(-6px);
  }
  40%,
  80% {
    transform: translateX(6px);
  }
}
@keyframes dim-in {
  from {
    opacity: 1;
  }
}
@keyframes badge-pop {
  from {
    transform: scale(0.4) rotate(-10deg);
    opacity: 0;
  }
}
@keyframes flame {
  0%,
  100% {
    transform: scale(1) rotate(-4deg);
  }
  50% {
    transform: scale(1.18) rotate(5deg);
  }
}
@keyframes xp-pop {
  0% {
    transform: translateY(10px) scale(0.5);
    opacity: 0;
  }
  60% {
    transform: translateY(-4px) scale(1.15);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .daily-glow,
  .daily-cal,
  .flame,
  .streak-badge,
  .xp-pop,
  .choice.animate {
    animation: none;
  }
}
</style>
