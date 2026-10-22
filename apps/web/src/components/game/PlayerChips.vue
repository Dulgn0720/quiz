<script setup lang="ts">
import type { PlayerPublic } from '@quiz/shared';
import { computed } from 'vue';
import { useGameStore } from '@/stores/game';

withDefaults(defineProps<{ players: PlayerPublic[]; kickable?: boolean; highlightId?: string; size?: 'md' | 'lg' }>(), {
  size: 'md',
});
defineEmits<{ kick: [player: PlayerPublic] }>();

// On the host screen, a player's latest emoji pops out of their chip (the store only holds reactions on the host).
const game = useGameStore();
const lastReaction = computed(() => new Map(game.reactions.map((r) => [r.playerId, r])));
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
      v-for="(player, i) in players"
      :key="player.id"
      :style="size === 'lg' ? { animationDelay: `${0.4 + (i % 7) * 0.35}s` } : undefined"
      class="relative flex items-center gap-2 rounded-full bg-white font-bold shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10"
      :class="[
        size === 'lg' ? 'chip-float py-2.5 pl-3 pr-4 text-xl' : 'py-1.5 pl-2 pr-3',
        { 'opacity-50': !player.connected },
        player.id === highlightId ? 'ring-2 ring-brand-500' : '',
      ]"
    >
      <span class="leading-none" :class="size === 'lg' ? 'text-3xl' : 'text-2xl'" aria-hidden="true">{{ player.avatar }}</span>
      <span>{{ player.nickname }}</span>
      <span v-if="player.team" class="text-xs font-semibold text-slate-400" :class="size === 'lg' ? 'text-sm' : ''">· {{ player.team }}</span>
      <span
        v-if="lastReaction.get(player.id)"
        :key="lastReaction.get(player.id)!.id"
        class="cheer-pop pointer-events-none absolute -top-7 left-1/2 text-3xl"
        aria-hidden="true"
      >
        {{ lastReaction.get(player.id)!.emoji }}
      </span>
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

<style scoped>
.cheer-pop {
  animation: cheer-pop 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes cheer-pop {
  0% { transform: translate(-50%, 12px) scale(0.3); opacity: 0; }
  25% { transform: translate(-50%, -6px) scale(1.25); opacity: 1; }
  70% { transform: translate(-50%, -10px) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -26px) scale(0.9); opacity: 0; }
}
.chip-float {
  animation: chip-float 3s ease-in-out infinite;
}
@keyframes chip-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
</style>
