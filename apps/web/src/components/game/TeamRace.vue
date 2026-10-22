<script setup lang="ts">
import type { TeamStanding } from '@quiz/shared';
import { computed, onMounted, ref } from 'vue';

/**
 * Department battle standings as racing bars. Bars grow from zero on first paint, then glide
 * to new widths; teams that gained places get a little bounce.
 */
const props = withDefaults(defineProps<{ teams: TeamStanding[]; highlight?: string; size?: 'md' | 'lg' }>(), {
  size: 'md',
});

const grown = ref(false);
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (grown.value = true))));

const max = computed(() => Math.max(1, ...props.teams.map((t) => t.score)));
const medal = (rank: number) => ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}`;
const lg = computed(() => props.size === 'lg');
</script>

<template>
  <ol class="flex flex-col" :class="lg ? 'gap-3' : 'gap-2'" :aria-label="$t('game.teams.title')">
    <li
      v-for="(team, i) in teams"
      :key="team.team"
      class="team-row relative overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-white/10"
      :class="[
        team.team === highlight ? 'ring-2 ring-brand-400' : '',
        team.rank < team.previousRank ? 'climbed' : '',
        lg ? 'px-5 py-4' : 'px-4 py-3',
      ]"
      :style="{ animationDelay: `${i * 90}ms` }"
    >
      <div
        class="absolute inset-y-0 left-0 rounded-2xl bg-gradient-to-r transition-[width] duration-1000 ease-out"
        :class="team.rank === 1 ? 'from-amber-400/50 to-brand-500/60' : 'from-sky-500/25 to-indigo-500/30'"
        :style="{ width: grown ? `${Math.max(6, (team.score / max) * 100)}%` : '0%' }"
        aria-hidden="true"
      />
      <div class="relative flex items-center gap-3">
        <span class="text-center font-display font-bold" :class="lg ? 'w-12 text-3xl' : 'w-8 text-xl'">{{ medal(team.rank) }}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-extrabold" :class="lg ? 'text-3xl' : 'text-lg'">
            {{ team.team }}<span v-if="team.rank === 1" class="crown ml-2 inline-block" aria-hidden="true">👑</span>
          </span>
          <span class="block font-semibold text-slate-300" :class="lg ? 'text-base' : 'text-xs'">
            {{ $t('game.teams.members', { n: team.members }) }}
          </span>
        </span>
        <span class="font-display font-bold tabular-nums" :class="lg ? 'text-3xl' : 'text-xl'">{{ team.score }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.team-row {
  animation: row-in 0.5s ease-out both;
}
.team-row.climbed {
  animation: row-in 0.5s ease-out both, climb 0.6s 0.9s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.crown {
  animation: crown 1.6s ease-in-out infinite;
}
@keyframes row-in {
  from { opacity: 0; transform: translateX(-24px); }
  to { opacity: 1; transform: none; }
}
@keyframes climb {
  0%, 100% { transform: none; }
  40% { transform: translateY(-6px) scale(1.02); }
}
@keyframes crown {
  0%, 100% { transform: rotate(-8deg) translateY(0); }
  50% { transform: rotate(8deg) translateY(-3px); }
}
</style>
