<script setup lang="ts">
import type { ChatEvent } from '@quiz/shared';
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '@/stores/game';

/** Players' comments on the big screen: the latest few, each fading out after a while. */
const SHOWN = 5;
const LIFETIME_MS = 15_000;

const { t } = useI18n();
const game = useGameStore();
const visible = ref<ChatEvent[]>([]);
const timers = new Set<ReturnType<typeof setTimeout>>();

watch(
  () => game.chat.at(-1)?.id,
  () => {
    const message = game.chat.at(-1);
    if (!message || visible.value.some((m) => m.id === message.id)) return;
    visible.value = [...visible.value.slice(-(SHOWN - 1)), message];
    const timer = setTimeout(() => {
      visible.value = visible.value.filter((m) => m.id !== message.id);
      timers.delete(timer);
    }, LIFETIME_MS);
    timers.add(timer);
  },
);
onBeforeUnmount(() => timers.forEach(clearTimeout));
</script>

<template>
  <aside
    class="pointer-events-none fixed bottom-24 left-4 z-20 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    :aria-label="t('game.chat.feed')"
    aria-live="polite"
  >
    <TransitionGroup name="bubble">
      <p
        v-for="m in visible"
        :key="m.id"
        class="flex items-start gap-2 rounded-2xl bg-ink-900/85 px-3 py-2 text-lg shadow-xl ring-1 ring-white/10 backdrop-blur"
      >
        <span class="text-2xl" aria-hidden="true">{{ m.avatar }}</span>
        <span class="min-w-0 break-words">
          <span class="font-bold text-brand-300">{{ m.nickname }}</span>
          {{ m.text }}
        </span>
      </p>
    </TransitionGroup>
  </aside>
</template>

<style scoped>
.bubble-enter-active,
.bubble-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.2, 1.4, 0.4, 1),
    opacity 0.35s ease;
}
.bubble-enter-from {
  transform: translateX(-30px) scale(0.9);
  opacity: 0;
}
.bubble-leave-to {
  opacity: 0;
}
.bubble-move {
  transition: transform 0.3s ease;
}
@media (prefers-reduced-motion: reduce) {
  .bubble-enter-active,
  .bubble-leave-active,
  .bubble-move {
    transition: none;
  }
}
</style>
