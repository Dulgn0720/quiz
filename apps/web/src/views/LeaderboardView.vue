<script setup lang="ts">
import { RANKS, rankForLevel, xpToReach, type TopPlayer, type TopPlayerPeriod, type TopPlayersResponse } from '@quiz/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { leaderboardApi } from '@/api/leaderboard';
import Mascot from '@/components/Mascot.vue';
import { useAuthStore } from '@/stores/auth';

/** Global leaderboard of registered players, with the Naadam-wrestling rank ladder. */
const { t, n } = useI18n();
const auth = useAuthStore();

const period = ref<TopPlayerPeriod>('all');
const data = ref<TopPlayersResponse | null>(null);
const loading = ref(true);
const failed = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    data.value = await leaderboardApi.top(period.value);
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(period, load);

const podium = computed(() => (data.value?.players ?? []).slice(0, 3));
const rest = computed(() => (data.value?.players ?? []).slice(3));
/** Your row, when you are not already in the list. */
const youOutside = computed(() => {
  const you = data.value?.you;
  return you && !data.value?.players.some((p) => p.isYou) ? you : undefined;
});

// Podium order on screen: 2nd, 1st, 3rd.
const podiumSlots = computed(() =>
  [
    { player: podium.value[1], height: 'h-24', medal: '🥈', tone: 'from-slate-200 to-slate-400' },
    { player: podium.value[0], height: 'h-32', medal: '🥇', tone: 'from-amber-300 to-brand-500' },
    { player: podium.value[2], height: 'h-16', medal: '🥉', tone: 'from-orange-200 to-orange-400' },
  ].filter((s): s is { player: TopPlayer; height: string; medal: string; tone: string } => s.player !== undefined),
);

const rankOf = (player: TopPlayer) => rankForLevel(player.level);
</script>

<template>
  <section class="mx-auto max-w-4xl px-4 py-8">
    <div class="flex flex-wrap items-end gap-4">
      <div class="mr-auto">
        <h1 class="text-3xl font-bold sm:text-4xl">{{ t('leaderboard.title') }}</h1>
        <p class="mt-1 text-slate-600 dark:text-slate-300">{{ t('leaderboard.subtitle') }}</p>
      </div>
      <div class="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-white/5" role="group" :aria-label="t('leaderboard.period')">
        <button
          v-for="option in (['all', 'month'] as const)"
          :key="option"
          type="button"
          class="rounded-full px-4 py-2 text-sm font-bold transition"
          :class="period === option ? 'bg-white text-ink-950 shadow-sm dark:bg-white/15 dark:text-white' : 'text-slate-600 dark:text-slate-300'"
          :aria-pressed="period === option"
          @click="period = option"
        >
          {{ t(`leaderboard.periods.${option}`) }}
        </button>
      </div>
    </div>

    <p v-if="loading && !data" class="mt-12 text-center text-slate-500">{{ t('common.loading') }}</p>
    <div v-else-if="failed" class="mt-10 text-center" role="alert">
      <p class="font-bold text-red-600 dark:text-red-300">{{ t('common.error') }}</p>
      <button type="button" class="btn-secondary mt-4" @click="load">{{ t('common.retry') }}</button>
    </div>

    <div v-else-if="data && data.players.length === 0" class="mt-12 flex flex-col items-center text-center">
      <Mascot mood="thinking" :size="140" />
      <p class="mt-3 max-w-md text-lg font-bold">{{ t(`leaderboard.empty.${period}`) }}</p>
      <RouterLink v-if="!auth.user" to="/register" class="btn-primary mt-6">{{ t('leaderboard.join') }}</RouterLink>
    </div>

    <template v-else-if="data">
      <!-- Podium -->
      <div class="mt-10 flex items-end justify-center gap-3 sm:gap-6">
        <div v-for="slot in podiumSlots" :key="slot.player.rank + slot.player.displayName" class="flex w-28 flex-col items-center text-center sm:w-44">
          <span class="text-5xl sm:text-6xl" aria-hidden="true">{{ slot.player.avatar ?? '🙂' }}</span>
          <span class="mt-1 max-w-full truncate text-lg font-extrabold" :class="slot.player.isYou ? 'text-brand-600 dark:text-brand-300' : ''">
            {{ slot.player.displayName }}
          </span>
          <span class="chip mt-1 bg-slate-100 text-xs dark:bg-white/10">{{ rankOf(slot.player).icon }} {{ t(`ranks.${rankOf(slot.player).code}`) }}</span>
          <span class="mt-1 font-display font-bold tabular-nums text-slate-600 dark:text-slate-300">{{ n(slot.player.xp) }} XP</span>
          <div class="mt-2 grid w-full place-items-center rounded-t-3xl bg-gradient-to-b text-4xl" :class="[slot.height, slot.tone]">
            <span aria-hidden="true">{{ slot.medal }}</span>
            <span class="sr-only">{{ t('game.podium.place', { n: slot.player.rank }) }}</span>
          </div>
        </div>
      </div>

      <!-- Everyone else -->
      <ol v-if="rest.length || youOutside" class="mt-6 flex flex-col gap-2">
        <li
          v-for="player in [...rest, ...(youOutside ? [youOutside] : [])]"
          :key="`${player.rank}-${player.displayName}`"
          class="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10"
          :class="player.isYou ? 'ring-2 ring-brand-500 dark:ring-brand-400' : ''"
        >
          <span class="w-9 text-center font-display text-lg font-bold tabular-nums text-slate-500 dark:text-slate-300">{{ player.rank }}</span>
          <span class="text-3xl leading-none" aria-hidden="true">{{ player.avatar ?? '🙂' }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-extrabold">
              {{ player.displayName }}
              <span v-if="player.isYou" class="chip ml-1 bg-brand-500 text-xs text-ink-950">{{ t('leaderboard.you') }}</span>
            </span>
            <span class="block text-sm text-slate-500 dark:text-slate-400">
              {{ rankOf(player).icon }} {{ t(`ranks.${rankOf(player).code}`) }} · {{ t('profile.levelShort', { n: player.level }) }} ·
              {{ t('leaderboard.games', { n: player.gamesPlayed }) }} · {{ t('leaderboard.wins', { n: player.wins }) }}
            </span>
          </span>
          <span class="font-display font-bold tabular-nums">{{ n(player.xp) }} <span class="text-xs text-slate-400">XP</span></span>
        </li>
      </ol>

      <RouterLink v-if="!auth.user" to="/register" class="card mt-6 block p-4 text-center font-bold text-brand-700 dark:text-brand-300">
        {{ t('leaderboard.join') }}
      </RouterLink>
    </template>

    <!-- Rank ladder -->
    <section class="card mt-12 p-6" aria-labelledby="ladder-title">
      <h2 id="ladder-title" class="text-xl font-bold">{{ t('leaderboard.ladder') }}</h2>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ t('leaderboard.ladderHelp') }}</p>
      <ol class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li
          v-for="rank in RANKS"
          :key="rank.code"
          class="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-200 dark:ring-white/10"
          :class="auth.user && rankForLevel(auth.user.level).code === rank.code ? 'bg-brand-500/10 ring-2 ring-brand-500' : ''"
        >
          <span class="text-3xl" aria-hidden="true">{{ rank.icon }}</span>
          <span>
            <span class="block font-extrabold">{{ t(`ranks.${rank.code}`) }}</span>
            <span class="block text-xs text-slate-500 dark:text-slate-400">
              {{ t('leaderboard.fromLevel', { n: rank.minLevel }) }} · {{ n(xpToReach(rank.minLevel)) }} XP
            </span>
          </span>
        </li>
      </ol>
    </section>
  </section>
</template>
