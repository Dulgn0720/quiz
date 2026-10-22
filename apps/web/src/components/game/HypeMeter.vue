<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Mascot from '@/components/Mascot.vue';
import { useEmojiRain } from '@/composables/useEmojiRain';
import { sound } from '@/game/sound';
import { useGameStore } from '@/stores/game';

/**
 * The room's hype on the big screen: every emoji reaction fills the meter, it
 * drains over time, and a full meter sets off a burst of the crowd's favourite emoji.
 */
const PER_REACTION = 7;
const DRAIN_PER_SECOND = 5;
const COOLDOWN_MS = 8000;

const { t } = useI18n();
const game = useGameStore();
const { rain } = useEmojiRain();

const level = ref(0);
const bursting = ref(false);
let cooldownUntil = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let burstTimer: ReturnType<typeof setTimeout> | undefined;

/** Emoji counts since the last burst, to rain the crowd's favourite. */
const counts = new Map<string, number>();

watch(
  () => game.reactions.length ? game.reactions[game.reactions.length - 1]!.id : 0,
  (id, before) => {
    if (!id || id === before) return;
    const latest = game.reactions[game.reactions.length - 1]!;
    counts.set(latest.emoji, (counts.get(latest.emoji) ?? 0) + 1);
    if (Date.now() < cooldownUntil) return;
    level.value = Math.min(100, level.value + PER_REACTION);
    if (level.value >= 100) burst();
  },
);

function burst(): void {
  const favourite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '🔥';
  counts.clear();
  bursting.value = true;
  cooldownUntil = Date.now() + COOLDOWN_MS;
  sound.play('sparkle');
  rain([favourite, favourite, '✨', '🔥']);
  clearTimeout(burstTimer);
  burstTimer = setTimeout(() => {
    bursting.value = false;
    level.value = 0;
  }, 2600);
}

const hot = computed(() => level.value >= 70);

onMounted(() => {
  timer = setInterval(() => {
    if (!bursting.value) level.value = Math.max(0, level.value - DRAIN_PER_SECOND / 4);
  }, 250);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  clearTimeout(burstTimer);
});
</script>

<template>
  <Transition name="hype">
    <div
      v-if="level > 0 || bursting"
      class="pointer-events-none fixed right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2 sm:right-5"
      aria-hidden="true"
    >
      <span class="font-display text-xs font-bold uppercase tracking-widest text-ink-200">{{ t('game.hype.label') }}</span>
      <div class="relative h-56 w-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15 sm:h-72 sm:w-6" :class="{ shake: hot && !bursting }">
        <div
          class="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-brand-500 via-amber-400 to-rose-400 transition-[height] duration-300 ease-out"
          :class="{ glow: hot || bursting }"
          :style="{ height: `${bursting ? 100 : level}%` }"
        />
      </div>
      <span class="text-3xl" :class="{ 'animate-bounce': hot }">{{ bursting ? '🤩' : hot ? '🔥' : '⚡' }}</span>
      <Transition name="hype-pop">
        <div v-if="bursting" class="absolute right-10 top-1/2 flex -translate-y-1/2 items-center gap-2 sm:right-12">
          <span class="whitespace-nowrap rounded-2xl bg-gradient-to-r from-rose-500 to-amber-400 px-4 py-2 font-display text-2xl font-bold text-white shadow-glow">
            {{ t('game.hype.burst') }}
          </span>
          <Mascot mood="love" :size="90" />
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.glow {
  box-shadow: 0 0 24px rgb(251 146 60 / 0.8);
}
.shake {
  animation: hype-shake 0.35s ease-in-out infinite;
}
@keyframes hype-shake {
  25% {
    transform: translateX(-1.5px) rotate(-1deg);
  }
  75% {
    transform: translateX(1.5px) rotate(1deg);
  }
}
.hype-enter-active,
.hype-leave-active {
  transition: opacity 0.4s ease;
}
.hype-enter-from,
.hype-leave-to {
  opacity: 0;
}
.hype-pop-enter-active {
  transition: all 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
}
.hype-pop-leave-active {
  transition: all 0.3s ease;
}
.hype-pop-enter-from,
.hype-pop-leave-to {
  opacity: 0;
  transform: translate(20px, -50%) scale(0.6);
}
@media (prefers-reduced-motion: reduce) {
  .shake {
    animation: none;
  }
}
</style>
