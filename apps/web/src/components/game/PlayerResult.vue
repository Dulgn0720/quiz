<script setup lang="ts">
import type { PlayerAnswerResult } from '@quiz/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';

/** The player's own outcome after a question is revealed, cheered on by the mascot. */
const props = defineProps<{ result: PlayerAnswerResult; seed?: number; solo?: boolean }>();
const { tm, rt } = useI18n();

const onFire = computed(() => props.result.correct && props.result.streak >= 3);

const mood = computed<MascotMood>(() => {
  if (!props.result.answered) return 'surprised';
  if (!props.result.correct) return 'sad';
  return onFire.value ? 'celebrate' : 'happy';
});

/** A different word of praise or comfort each question (stable while the card is shown). */
const message = computed(() => {
  const key = !props.result.answered
    ? 'game.praise.noAnswer'
    : !props.result.correct
      ? 'game.praise.wrong'
      : props.result.breakdown.speed >= props.result.breakdown.base * 0.4
        ? 'game.praise.fast'
        : 'game.praise.correct';
  const list = tm(key) as unknown[];
  if (!Array.isArray(list) || list.length === 0) return '';
  const index = Math.abs((props.seed ?? 0) + props.result.score) % list.length;
  return rt(list[index] as Parameters<typeof rt>[0]);
});
</script>

<template>
  <div class="flex flex-col items-center">
    <Mascot :mood="mood" :size="110" class="relative z-[1] -mb-6" />
    <div
      class="flex w-full animate-pop flex-col items-center gap-2 rounded-3xl px-6 pb-7 pt-9 text-center text-white shadow-lg"
      :class="
        result.correct
          ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
          : result.answered
            ? 'bg-gradient-to-br from-rose-600 to-pink-700'
            : 'bg-gradient-to-br from-slate-600 to-slate-700'
      "
      role="status"
    >
      <p class="font-display text-3xl font-bold">
        {{ result.correct ? $t('game.reveal.correct') : result.answered ? $t('game.reveal.incorrect') : $t('game.reveal.noAnswer') }}
      </p>
      <p v-if="message" class="text-lg font-bold text-white/90">{{ message }}</p>
      <p v-if="result.correct" class="font-display text-5xl font-bold tabular-nums">+{{ result.points }}</p>
      <p v-if="result.correct && (result.breakdown.speed > 0 || result.breakdown.streak > 0)" class="text-base font-bold">
        {{ $t('game.reveal.breakdown', { base: result.breakdown.base, speed: result.breakdown.speed, streak: result.breakdown.streak }) }}
      </p>
      <p v-if="onFire" class="fire-banner mt-1 rounded-full bg-black/25 px-4 py-1.5 text-lg font-extrabold">
        <span aria-hidden="true">🔥</span> {{ $t('game.reveal.onFire', { n: result.streak }) }}
      </p>
      <p v-else-if="result.streak >= 2" class="font-bold">{{ $t('game.reveal.streak', { n: result.streak }) }}</p>
      <p v-if="result.eliminated" class="rounded-full bg-white/20 px-3 py-1 font-bold">{{ $t('game.reveal.eliminated') }}</p>
      <p class="mt-2 text-lg font-bold">
        {{ solo ? $t('practice.total', { score: result.score }) : $t('game.reveal.rank', { n: result.rank, score: result.score }) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.fire-banner {
  animation: flicker 1.2s ease-in-out infinite;
  box-shadow: 0 0 24px rgb(251 146 60 / 0.6);
}
@keyframes flicker {
  0%, 100% { transform: scale(1); box-shadow: 0 0 18px rgb(251 146 60 / 0.5); }
  50% { transform: scale(1.05); box-shadow: 0 0 32px rgb(251 146 60 / 0.8); }
}
</style>
