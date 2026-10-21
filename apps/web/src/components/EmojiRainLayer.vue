<script setup lang="ts">
import { useEmojiRain } from '@/composables/useEmojiRain';

const { drops } = useEmojiRain();
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
    <span
      v-for="drop in drops"
      :key="drop.id"
      class="drop absolute top-0 leading-none"
      :style="{
        left: `${drop.x}%`,
        fontSize: `${drop.size}rem`,
        animationDelay: `${drop.delay}s`,
        animationDuration: `${drop.duration}s`,
        '--spin': `${drop.spin}deg`,
      }"
    >
      {{ drop.emoji }}
    </span>
  </div>
</template>

<style scoped>
.drop {
  transform: translateY(-15vh);
  animation-name: fall;
  animation-timing-function: cubic-bezier(0.45, 0, 0.75, 1);
  animation-fill-mode: both;
}
@keyframes fall {
  from {
    transform: translateY(-15vh) rotate(0);
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  to {
    transform: translateY(110vh) rotate(var(--spin));
    opacity: 0;
  }
}
</style>
