<script setup lang="ts">
import { AVATARS, BADGES, nextRank, rankForLevel, type GameHistoryEntry } from '@quiz/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { authApi } from '@/api/auth';
import LevelBar from '@/components/LevelBar.vue';
import Mascot from '@/components/Mascot.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';

const { t, locale } = useI18n();
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const history = ref<GameHistoryEntry[]>([]);
const historyTotal = ref(0);
const page = ref(1);
const loading = ref(true);
const editing = ref(false);
const nameDraft = ref('');
const avatarDraft = ref<string | null>(null);

const profile = computed(() => auth.profile);
const earned = computed(() => new Map(profile.value?.badges.map((b) => [b.code, b]) ?? []));

onMounted(async () => {
  try {
    await auth.refresh();
    const res = await authApi.history(1);
    history.value = res.items;
    historyTotal.value = res.total;
  } catch {
    toast.error(t('common.error'));
  } finally {
    loading.value = false;
  }
});

async function loadMore(): Promise<void> {
  const res = await authApi.history(page.value + 1);
  page.value += 1;
  history.value = [...history.value, ...res.items];
}

function startEdit(): void {
  nameDraft.value = auth.user?.displayName ?? '';
  avatarDraft.value = auth.user?.avatar ?? null;
  editing.value = true;
}

async function saveEdit(): Promise<void> {
  try {
    await auth.update({ displayName: nameDraft.value, avatar: (avatarDraft.value ?? null) as (typeof AVATARS)[number] | null });
    editing.value = false;
    toast.success(t('common.saved'));
  } catch {
    toast.error(t('common.error'));
  }
}

function logout(): void {
  auth.logout();
  void router.push({ name: 'home' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(locale.value === 'mn' ? 'mn-MN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
</script>

<template>
  <section class="mx-auto max-w-4xl px-4 py-8">
    <p v-if="loading && !profile" class="mt-16 text-center text-slate-500 dark:text-slate-400">{{ t('common.loading') }}</p>

    <template v-else-if="profile">
      <div class="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <span class="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-brand-100 dark:bg-brand-900/40 text-5xl" aria-hidden="true">
          {{ profile.avatar ?? '🙂' }}
        </span>
        <div class="flex-1">
          <template v-if="!editing">
            <h1 class="text-3xl font-black">{{ profile.displayName }}</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ profile.email }}</p>
          </template>
          <form v-else class="flex flex-col gap-3" @submit.prevent="saveEdit">
            <label class="block">
              <span class="label">{{ t('auth.displayName') }}</span>
              <input v-model="nameDraft" class="input" maxlength="40" required />
            </label>
            <div class="grid grid-cols-8 gap-1" role="radiogroup" :aria-label="t('game.join.avatar')">
              <button
                v-for="emoji in AVATARS"
                :key="emoji"
                type="button"
                role="radio"
                :aria-checked="avatarDraft === emoji"
                class="grid aspect-square place-items-center rounded-lg text-xl ring-1 ring-slate-200 dark:ring-slate-700"
                :class="avatarDraft === emoji ? 'bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-500' : ''"
                @click="avatarDraft = emoji"
              >
                {{ emoji }}
              </button>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary">{{ t('common.save') }}</button>
              <button type="button" class="btn-ghost" @click="editing = false">{{ t('common.cancel') }}</button>
            </div>
          </form>
          <LevelBar class="mt-4" :progress="profile.progress" :xp="profile.xp" />
          <RouterLink
            to="/leaderboard"
            class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-brand-500/10 px-4 py-2.5 text-sm ring-1 ring-brand-500/20 transition hover:bg-brand-500/15"
          >
            <span class="text-2xl" aria-hidden="true">{{ rankForLevel(profile.level).icon }}</span>
            <span class="font-extrabold">{{ t('profile.rank', { rank: t(`ranks.${rankForLevel(profile.level).code}`) }) }}</span>
            <span v-if="nextRank(profile.level)" class="text-slate-600 dark:text-slate-300">
              · {{ t('profile.nextRank', { rank: t(`ranks.${nextRank(profile.level)!.code}`), n: nextRank(profile.level)!.minLevel }) }}
            </span>
            <span class="ml-auto font-bold text-brand-700 dark:text-brand-300">{{ t('nav.leaderboard') }} →</span>
          </RouterLink>
        </div>
        <div v-if="!editing" class="flex gap-2 sm:flex-col">
          <button type="button" class="btn-secondary" @click="startEdit">{{ t('common.edit') }}</button>
          <button type="button" class="btn-ghost" @click="logout">{{ t('auth.logout') }}</button>
        </div>
      </div>

      <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="(value, key) in profile.stats" :key="key" class="card p-4 text-center">
          <dt class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t(`profile.stats.${key}`) }}</dt>
          <dd class="text-2xl font-black tabular-nums">{{ value }}</dd>
        </div>
      </dl>

      <h2 class="mt-10 text-2xl font-black">{{ t('profile.badges') }}</h2>
      <ul class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <li
          v-for="badge in BADGES"
          :key="badge.code"
          class="card flex items-center gap-3 p-4"
          :class="earned.has(badge.code) ? 'ring-2 ring-brand-400/60' : ''"
        >
          <span class="text-3xl" :class="earned.has(badge.code) ? '' : 'opacity-35 grayscale'" aria-hidden="true">{{ badge.icon }}</span>
          <span class="min-w-0">
            <span class="flex items-center gap-1.5 font-bold" :class="earned.has(badge.code) ? '' : 'text-slate-600 dark:text-slate-300'">
              {{ t(`badges.${badge.code}.name`) }}
              <span v-if="!earned.has(badge.code)" class="chip bg-slate-100 px-1.5 text-slate-500 dark:bg-white/10 dark:text-slate-400">
                <span aria-hidden="true">🔒</span><span class="sr-only">{{ t('profile.locked') }}</span>
              </span>
            </span>
            <span class="block text-xs text-slate-500 dark:text-slate-400">{{ t(`badges.${badge.code}.description`) }}</span>
          </span>
        </li>
      </ul>

      <h2 class="mt-10 text-2xl font-black">{{ t('profile.history') }}</h2>
      <div v-if="history.length === 0" class="mt-4 flex items-center gap-3 text-slate-500 dark:text-slate-400">
        <Mascot mood="wave" :size="70" />
        {{ t('profile.noHistory') }}
        <RouterLink to="/join" class="font-bold text-brand-700 dark:text-brand-300 underline">{{ t('nav.join') }}</RouterLink>
      </div>
      <ul v-else class="mt-4 flex flex-col gap-2">
        <li v-for="game in history" :key="game.gameId" class="card flex flex-wrap items-center gap-3 p-4">
          <span class="w-10 text-center text-2xl font-black tabular-nums">
            {{ game.rank === 1 ? '🥇' : game.rank === 2 ? '🥈' : game.rank === 3 ? '🥉' : game.rank ? `#${game.rank}` : '—' }}
          </span>
          <span class="mr-auto">
            <span class="block font-black">{{ game.quizTitle }}</span>
            <span class="block text-xs text-slate-500 dark:text-slate-400">
              {{ formatDate(game.playedAt) }} · {{ t('game.lobby.players', { n: game.playerCount }, game.playerCount) }}
            </span>
          </span>
          <span class="text-sm font-bold text-slate-600 dark:text-slate-300">✔ {{ game.correctCount }}/{{ game.answerCount }}</span>
          <span class="text-lg font-black tabular-nums">{{ game.score }}</span>
          <span v-if="game.xpEarned" class="rounded-full bg-brand-100 dark:bg-brand-900/40 px-2 py-0.5 text-xs font-bold text-brand-800 dark:text-brand-200">
            +{{ game.xpEarned }} XP
          </span>
        </li>
      </ul>
      <div v-if="history.length < historyTotal" class="mt-4 text-center">
        <button type="button" class="btn-secondary" @click="loadMore">{{ t('quizList.loadMore') }}</button>
      </div>
    </template>
  </section>
</template>
