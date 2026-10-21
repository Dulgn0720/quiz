<script setup lang="ts">
import type { PublicRoomSummary } from '@quiz/shared';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiError } from '@/api/client';
import { gamesApi } from '@/api/games';

const REFRESH_MS = 5000;

const { t } = useI18n();
const rooms = ref<PublicRoomSummary[]>([]);
const loaded = ref(false);
const error = ref('');
let timer: ReturnType<typeof setInterval> | undefined;

async function load(): Promise<void> {
  try {
    rooms.value = await gamesApi.listPublic();
    error.value = '';
  } catch (e) {
    error.value = e instanceof ApiError && e.isNetworkError ? t('common.networkError') : t('common.error');
  } finally {
    loaded.value = true;
  }
}

onMounted(() => {
  void load();
  timer = setInterval(() => void load(), REFRESH_MS);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section class="mx-auto max-w-4xl px-4 py-8">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-3xl font-black">{{ t('rooms.title') }}</h1>
      <RouterLink to="/join" class="btn-secondary">{{ t('rooms.havePin') }}</RouterLink>
    </div>
    <p class="mt-2 text-slate-600 dark:text-slate-300">{{ t('rooms.subtitle') }}</p>

    <p v-if="error" class="mt-8 rounded-2xl bg-red-50 dark:bg-red-950/40 p-4 text-center font-bold text-red-700 dark:text-red-300" role="alert">{{ error }}</p>
    <p v-else-if="loaded && rooms.length === 0" class="mt-16 text-center text-slate-500 dark:text-slate-400">{{ t('rooms.empty') }}</p>
    <p v-else-if="!loaded" class="mt-16 text-center text-slate-500 dark:text-slate-400">{{ t('common.loading') }}</p>

    <TransitionGroup
      tag="ul"
      class="mt-6 grid gap-3 sm:grid-cols-2"
      enter-from-class="opacity-0 scale-95"
      enter-active-class="transition duration-300"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-200"
      aria-live="polite"
    >
      <li v-for="room in rooms" :key="room.pin" class="card flex items-center gap-4 p-5">
        <span class="mr-auto">
          <span class="block text-lg font-black">{{ room.quizTitle }}</span>
          <span class="block text-sm text-slate-500 dark:text-slate-400">
            PIN {{ room.pin }} · {{ t('game.lobby.players', { n: room.playerCount }, room.playerCount) }}
          </span>
        </span>
        <RouterLink :to="{ name: 'join-pin', params: { pin: room.pin } }" class="btn-primary">{{ t('rooms.join') }}</RouterLink>
      </li>
    </TransitionGroup>
  </section>
</template>
