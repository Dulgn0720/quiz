<script setup lang="ts">
import type { PlayerPublic } from '@quiz/shared';

withDefaults(defineProps<{ players: PlayerPublic[]; kickable?: boolean; highlightId?: string; size?: 'md' | 'lg' }>(), {
  size: 'md',
});
defineEmits<{ kick: [player: PlayerPublic] }>();
</script>

<template>
  <TransitionGroup
    tag="ul"
    class="flex flex-wrap justify-center gap-2"
    enter-from-class="scale-50 opacity-0"
    enter-active-class="transition duration-300 ease-out"
    leave-to-class="scale-50 opacity-0"
    leave-active-class="transition duration-200 ease-in absolute"
    move-class="transition duration-300"
  >
    <li
      v-for="player in players"
      :key="player.id"
      class="flex items-center gap-2 rounded-full bg-white font-bold shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10"
      :class="[
        size === 'lg' ? 'py-2.5 pl-3 pr-4 text-xl' : 'py-1.5 pl-2 pr-3',
        { 'opacity-50': !player.connected },
        player.id === highlightId ? 'ring-2 ring-brand-500' : '',
      ]"
    >
      <span class="leading-none" :class="size === 'lg' ? 'text-3xl' : 'text-2xl'" aria-hidden="true">{{ player.avatar }}</span>
      <span>{{ player.nickname }}</span>
      <span v-if="!player.connected" class="sr-only">({{ $t('game.lobby.offline') }})</span>
      <button
        v-if="kickable"
        type="button"
        class="-mr-1 grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        :aria-label="$t('game.lobby.kick', { name: player.nickname })"
        @click="$emit('kick', player)"
      >
        ✕
      </button>
    </li>
  </TransitionGroup>
</template>
