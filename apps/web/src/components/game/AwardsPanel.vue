<script setup lang="ts">
import type { PlayerStats } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sound } from '@/game/sound';

/**
 * Fun end-of-game awards for the big screen, shown after the podium:
 * fastest average answer, longest streak and best accuracy.
 */
const props = withDefaults(defineProps<{ results: PlayerStats[]; delayMs?: number }>(), { delayMs: 3200 });

interface Award {
  key: 'fastest' | 'streak' | 'sharpshooter';
  icon: string;
  player: PlayerStats;
  value: string | number;
}

const awards = computed<Award[]>(() => {
  const players = props.results;
  if (players.length < 2) return [];
  const list: Award[] = [];

  // Fastest: lowest average time among players who answered at least half of the questions.
  const fast = players
    .filter((p) => p.avgResponseMs !== null && p.answerCount * 2 >= p.questionCount && p.correctCount > 0)
    .sort((a, b) => a.avgResponseMs! - b.avgResponseMs!)[0];
  if (fast) list.push({ key: 'fastest', icon: '⚡', player: fast, value: (fast.avgResponseMs! / 1000).toFixed(1) });

  const streak = [...players].sort((a, b) => b.bestStreak - a.bestStreak || a.rank - b.rank)[0];
  if (streak && streak.bestStreak >= 2) list.push({ key: 'streak', icon: '🔥', player: streak, value: streak.bestStreak });

  const accuracy = (p: PlayerStats) => (p.questionCount ? p.correctCount / p.questionCount : 0);
  const sharp = [...players].sort((a, b) => accuracy(b) - accuracy(a) || a.rank - b.rank)[0];
  if (sharp && sharp.correctCount > 0) {
    list.push({ key: 'sharpshooter', icon: '🎯', player: sharp, value: Math.round(accuracy(sharp) * 100) });
  }
  return list;
});

const shown = ref(0);
const timers: ReturnType<typeof setTimeout>[] = [];
onMounted(() => {
  awards.value.forEach((_, i) => {
    timers.push(
      setTimeout(() => {
        shown.value = i + 1;
        sound.play('sparkle');
      }, props.delayMs + i * 700),
    );
  });
});
onBeforeUnmount(() => timers.forEach(clearTimeout));
</script>

<template>
  <section v-if="awards.length" :aria-label="$t('game.awards.title')">
    <h3 class="mb-4 text-center text-2xl font-bold text-slate-300">{{ $t('game.awards.title') }}</h3>
    <ul class="grid gap-4 sm:grid-cols-3">
      <Transition
        v-for="(award, i) in awards"
        :key="award.key"
        enter-from-class="translate-y-6 scale-90 opacity-0"
        enter-active-class="transition duration-500 ease-out"
      >
        <li v-if="shown > i" class="award flex flex-col items-center gap-1 rounded-3xl bg-white/[0.06] p-5 text-center ring-1 ring-white/10">
          <span class="text-5xl" aria-hidden="true">{{ award.icon }}</span>
          <p class="text-sm font-bold uppercase tracking-wide text-brand-300">{{ $t(`game.awards.${award.key}.name`) }}</p>
          <p class="flex max-w-full items-center gap-2 truncate text-2xl font-extrabold">
            <span aria-hidden="true">{{ award.player.avatar }}</span>
            <span class="truncate">{{ award.player.nickname }}</span>
          </p>
          <p class="font-semibold text-slate-300">{{ $t(`game.awards.${award.key}.value`, { n: award.value }) }}</p>
        </li>
      </Transition>
    </ul>
  </section>
</template>

<style scoped>
.award {
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.04), 0 10px 40px -10px rgb(245 124 20 / 0.35);
}
</style>
