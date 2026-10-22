<script setup lang="ts">
import { dailyDayKey, previousDayKey } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';
import SoundToggles from '@/components/SoundToggles.vue';
import { useConfetti } from '@/composables/useConfetti';
import { sound } from '@/game/sound';
import {
  dailyWord,
  HINT_AFTER,
  isLetter,
  KEYBOARD_ROWS,
  keyboardStates,
  loadStats,
  MAX_GUESSES,
  randomWord,
  recordDaily,
  saveStats,
  scoreGuess,
  shareText,
  WORD_LENGTH,
  type LetterState,
} from '@/game/word-game';
import type { WordEntry } from '@/game/words';

const { t } = useI18n();
const confetti = useConfetti();

const today = dailyDayKey();
const stats = ref(loadStats());
const mode = ref<'daily' | 'free'>('daily');
const target = ref<WordEntry>(dailyWord(today));
const guesses = ref<string[]>(stats.value.today?.day === today ? [...stats.value.today.guesses] : []);
const typed = ref('');
const shake = ref(false);
const message = ref('');
const showHint = ref(false);
const copied = ref(false);

const won = computed(() => guesses.value.includes(target.value.word));
const over = computed(() => won.value || guesses.value.length >= MAX_GUESSES);
const keys = computed(() => keyboardStates(guesses.value, target.value.word));
const hintReady = computed(() => !over.value && guesses.value.length >= HINT_AFTER);

const rows = computed(() =>
  Array.from({ length: MAX_GUESSES }, (_, r) => {
    const guess = guesses.value[r];
    if (guess !== undefined) {
      const states = scoreGuess(guess, target.value.word);
      return { letters: [...guess], states, done: true };
    }
    const current = r === guesses.value.length && !over.value ? [...typed.value] : [];
    return { letters: Array.from({ length: WORD_LENGTH }, (_, i) => current[i] ?? ''), states: [] as LetterState[], done: false };
  }),
);

const mood = computed<MascotMood>(() => {
  if (won.value) return 'celebrate';
  if (over.value) return 'sad';
  if (guesses.value.length >= MAX_GUESSES - 1) return 'nervous';
  return guesses.value.length ? 'thinking' : 'happy';
});

const maxDistribution = computed(() => Math.max(1, ...stats.value.distribution));
const winRate = computed(() => (stats.value.played ? Math.round((stats.value.wins / stats.value.played) * 100) : 0));

function flash(text: string): void {
  message.value = text;
  shake.value = true;
  window.setTimeout(() => (shake.value = false), 500);
  window.setTimeout(() => {
    if (message.value === text) message.value = '';
  }, 1800);
}

function press(key: string): void {
  if (over.value) return;
  if (key === 'enter') return submit();
  if (key === 'back') {
    typed.value = [...typed.value].slice(0, -1).join('');
    return;
  }
  if ([...typed.value].length < WORD_LENGTH && isLetter(key)) {
    typed.value += key.toLowerCase();
    sound.play('pop');
  }
}

function submit(): void {
  if ([...typed.value].length < WORD_LENGTH) return flash(t('wordGame.tooShort', { n: WORD_LENGTH }));
  if (guesses.value.includes(typed.value)) return flash(t('wordGame.repeat'));
  guesses.value = [...guesses.value, typed.value];
  typed.value = '';
  if (mode.value === 'daily') persistToday();
  if (won.value) {
    sound.play('fanfare');
    window.setTimeout(() => confetti.celebrate(), 900);
  } else if (over.value) {
    sound.play('wrong');
  } else {
    sound.play('answer');
  }
  if (over.value && mode.value === 'daily') {
    stats.value = recordDaily(stats.value, today, previousDayKey(today), guesses.value.length, won.value);
    persistToday();
  }
}

function persistToday(): void {
  stats.value = { ...stats.value, today: { day: today, guesses: [...guesses.value] } };
  saveStats(stats.value);
}

function playFree(): void {
  mode.value = 'free';
  target.value = randomWord(target.value.word);
  guesses.value = [];
  typed.value = '';
  showHint.value = false;
}

async function share(): Promise<void> {
  const text = shareText(today, guesses.value, target.value.word, won.value);
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      copied.value = true;
      window.setTimeout(() => (copied.value = false), 2000);
    }
  } catch {
    // Cancelled or not allowed: nothing to do.
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Enter') press('enter');
  else if (event.key === 'Backspace') press('back');
  else if (isLetter(event.key)) press(event.key);
  else return;
  event.preventDefault();
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

const tile: Record<LetterState, string> = {
  hit: 'bg-emerald-500 text-white ring-emerald-400',
  near: 'bg-amber-400 text-ink-950 ring-amber-300',
  miss: 'bg-slate-800 text-white/60 ring-slate-700',
};
const keyTone: Record<LetterState, string> = {
  hit: 'bg-emerald-500 text-white',
  near: 'bg-amber-400 text-ink-950',
  miss: 'bg-black/50 text-white/20',
};
</script>

<template>
  <div class="dark stage min-h-dvh">
    <section class="mx-auto flex min-h-dvh max-w-lg flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
      <header class="sticky top-0 z-10 -mx-3 mb-2 flex items-center gap-3 bg-ink-950/70 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:-mx-4 sm:px-4">
        <span class="chip shrink-0 whitespace-nowrap bg-emerald-500/15 px-3 py-1 text-emerald-300 ring-1 ring-emerald-400/30">🔤 {{ t('wordGame.title') }}</span>
        <span class="mr-auto truncate text-sm font-bold text-slate-400">
          {{ mode === 'daily' ? t('wordGame.daily', { day: today }) : t('wordGame.free') }}
        </span>
        <span v-if="stats.streak" class="rounded-full bg-orange-500/20 px-2.5 py-1 text-sm font-bold text-orange-200" :title="t('wordGame.streak')">🔥 {{ stats.streak }}</span>
        <SoundToggles />
        <RouterLink to="/" class="btn-icon" :aria-label="t('survival.home')">✕</RouterLink>
      </header>

      <details class="group mb-2 text-sm text-slate-300">
        <summary class="flex cursor-pointer list-none items-center gap-2 font-bold text-slate-400 hover:text-white">
          <Mascot :mood="mood" :size="32" /> {{ t('wordGame.howTo') }}
          <span class="transition group-open:rotate-180" aria-hidden="true">▾</span>
        </summary>
        <p class="mt-1 font-semibold">{{ t('wordGame.rules', { n: MAX_GUESSES }) }}</p>
      </details>

      <!-- Board: sized so the board and keyboard fit on one phone screen. -->
      <div class="relative flex flex-1 flex-col items-center justify-center">
        <div class="board grid w-full gap-1.5" role="grid" :aria-label="t('wordGame.board')">
          <div
            v-for="(row, r) in rows"
            :key="r"
            class="grid grid-cols-5 gap-1.5"
            :class="r === guesses.length && shake ? 'shake' : ''"
            role="row"
          >
            <span
              v-for="(letter, i) in row.letters"
              :key="i"
              role="gridcell"
              class="tile flex aspect-square items-center justify-center rounded-xl font-display text-[clamp(1.25rem,6vw,1.9rem)] font-bold uppercase ring-2"
              :class="[
                row.done ? `flip ${tile[row.states[i]!]}` : letter ? 'pop bg-white/10 ring-white/50' : 'bg-white/[0.03] ring-white/10',
              ]"
              :style="row.done ? { animationDelay: `${i * 120}ms` } : undefined"
            >
              {{ letter }}
              <span v-if="row.done" class="sr-only">{{ t(`wordGame.state.${row.states[i]}`) }}</span>
            </span>
          </div>
        </div>
        <p
          v-if="message"
          class="absolute top-2 animate-pop rounded-full bg-white px-4 py-1.5 font-bold text-ink-950 shadow-xl"
          aria-live="assertive"
        >
          {{ message }}
        </p>
      </div>

      <!-- Hint -->
      <div v-if="hintReady" class="mt-2 text-center">
        <button v-if="!showHint" type="button" class="btn-secondary px-4 py-1 text-sm" @click="showHint = true">💡 {{ t('wordGame.showHint') }}</button>
        <p v-else class="mx-auto max-w-sm rounded-2xl bg-sky-500/10 px-4 py-1.5 text-sm text-sky-100 ring-1 ring-sky-400/20">💡 {{ target.hint }}</p>
      </div>

      <!-- Result -->
      <div v-if="over" class="card mt-2 animate-pop p-5 text-center" role="status">
        <p class="font-display text-2xl font-bold">{{ won ? t('wordGame.won', { n: guesses.length }) : t('wordGame.lost') }}</p>
        <p class="mt-1 text-slate-300">
          {{ t('wordGame.answer') }} <strong class="font-display text-xl uppercase tracking-widest text-emerald-300">{{ target.word }}</strong>
        </p>
        <p class="text-sm text-slate-400">💡 {{ target.hint }}</p>

        <template v-if="mode === 'daily'">
          <dl class="mt-4 grid grid-cols-4 gap-2">
            <div><dt class="text-xs font-bold text-slate-400">{{ t('wordGame.played') }}</dt><dd class="font-display text-2xl font-bold">{{ stats.played }}</dd></div>
            <div><dt class="text-xs font-bold text-slate-400">{{ t('wordGame.winRate') }}</dt><dd class="font-display text-2xl font-bold">{{ winRate }}%</dd></div>
            <div><dt class="text-xs font-bold text-slate-400">{{ t('wordGame.streak') }}</dt><dd class="font-display text-2xl font-bold">{{ stats.streak }}</dd></div>
            <div><dt class="text-xs font-bold text-slate-400">{{ t('wordGame.best') }}</dt><dd class="font-display text-2xl font-bold">{{ stats.best }}</dd></div>
          </dl>
          <ol class="mt-4 space-y-1 text-left" :aria-label="t('wordGame.distribution')">
            <li v-for="(count, i) in stats.distribution" :key="i" class="flex items-center gap-2 text-sm font-bold">
              <span class="w-3 tabular-nums">{{ i + 1 }}</span>
              <span
                class="rounded-md px-2 py-0.5 text-right tabular-nums"
                :class="won && guesses.length === i + 1 ? 'bg-emerald-500' : 'bg-white/15'"
                :style="{ width: `${Math.max(8, (count / maxDistribution) * 100)}%` }"
              >{{ count }}</span>
            </li>
          </ol>
          <p class="mt-3 text-sm text-slate-400">{{ t('wordGame.comeBack') }}</p>
        </template>

        <div class="mt-4 flex flex-col gap-2 sm:flex-row">
          <button v-if="mode === 'daily'" type="button" class="btn-primary flex-1" @click="share">
            {{ copied ? `✔ ${t('wordGame.copied')}` : `📤 ${t('wordGame.share')}` }}
          </button>
          <button type="button" class="btn-secondary flex-1" @click="playFree">🎲 {{ t('wordGame.playFree') }}</button>
        </div>
      </div>

      <!-- Keyboard -->
      <div v-else class="space-y-1.5 pt-3" role="group" :aria-label="t('wordGame.keyboard')">
        <div v-for="(row, r) in KEYBOARD_ROWS" :key="r" class="flex justify-center gap-1">
          <button
            v-for="key in row"
            :key="key"
            type="button"
            class="h-11 min-w-0 flex-1 rounded-lg text-lg font-bold uppercase transition active:scale-90 sm:h-12"
            :class="keys.get(key) ? keyTone[keys.get(key)!] : 'bg-white/15 text-white hover:bg-white/25'"
            @click="press(key)"
          >
            {{ key }}
          </button>
        </div>
        <div class="flex gap-1.5">
          <button type="button" class="btn-secondary h-11 flex-1 sm:h-12" :aria-label="t('wordGame.delete')" @click="press('back')">⌫</button>
          <button type="button" class="btn-primary h-11 flex-[2] sm:h-12" @click="press('enter')">{{ t('wordGame.check') }} ↵</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Six rows of square tiles; the height left after header, hint and keyboard (about 22rem) sets the width. */
.board {
  max-width: min(20rem, calc((100dvh - 22rem) * 5 / 6));
}
.pop {
  animation: pop 0.12s ease-out;
}
.flip {
  animation: flip 0.5s ease both;
}
.shake {
  animation: shake 0.45s ease;
}
@keyframes pop {
  50% {
    transform: scale(1.12);
  }
}
@keyframes flip {
  0% {
    transform: rotateX(90deg);
    opacity: 0.4;
  }
  100% {
    transform: rotateX(0);
    opacity: 1;
  }
}
@keyframes shake {
  20%,
  60% {
    transform: translateX(-6px);
  }
  40%,
  80% {
    transform: translateX(6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .pop,
  .flip,
  .shake {
    animation: none;
  }
}
</style>
