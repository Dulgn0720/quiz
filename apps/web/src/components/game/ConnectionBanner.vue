<script setup lang="ts">
import { useGameStore } from '@/stores/game';

const game = useGameStore();
</script>

<template>
  <Transition
    enter-from-class="-translate-y-full opacity-0"
    leave-to-class="-translate-y-full opacity-0"
    enter-active-class="transition duration-300"
    leave-active-class="transition duration-300"
  >
    <div
      v-if="game.status === 'reconnecting' || game.status === 'connecting'"
      class="fixed inset-x-0 top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-bold text-amber-950"
      role="status"
    >
      {{ game.status === 'connecting' ? $t('game.status.connecting') : $t('game.status.reconnecting') }}
    </div>
  </Transition>
</template>
