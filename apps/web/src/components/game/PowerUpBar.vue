<script setup lang="ts">
import { GAME_ERRORS, type PlayerPowerUps, type PowerUp, type QuestionPublic } from '@quiz/shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { sound } from '@/game/sound';
import { useToast } from '@/composables/useToast';
import { useGameStore } from '@/stores/game';

/** The player's power-ups for the open question: 50/50 and double points, once each per game. */
const props = defineProps<{ question: QuestionPublic; powerUps: PlayerPowerUps }>();
const { t } = useI18n();
const game = useGameStore();
const toast = useToast();
const busy = ref<PowerUp | null>(null);

const ICONS: Record<PowerUp, string> = { fifty: '✂️', double: '×2' };

/** 50/50 only makes sense on single choice with three or more options. */
const fiftyFits = computed(
  () => (props.question.type === 'single' || props.question.type === 'image') && props.question.options.length >= 3,
);

function state(p: PowerUp): 'active' | 'ready' | 'unfit' | 'used' {
  if (p === 'double' && props.powerUps.double) return 'active';
  if (p === 'fifty' && props.powerUps.hidden) return 'active';
  if (!props.powerUps.available.includes(p)) return 'used';
  if (p === 'fifty' && !fiftyFits.value) return 'unfit';
  return 'ready';
}

async function use(p: PowerUp): Promise<void> {
  if (busy.value || state(p) !== 'ready') return;
  busy.value = p;
  const result = await game.usePowerUp(p);
  busy.value = null;
  if (result.ok) sound.play(p === 'double' ? 'sparkle' : 'whoosh');
  else if (result.error !== GAME_ERRORS.alreadyAnswered) toast.error(t(`game.errors.${result.error}`));
}
</script>

<template>
  <div class="flex items-center justify-center gap-2" role="group" :aria-label="t('game.powerUps.label')">
    <button
      v-for="p in (['fifty', 'double'] as const)"
      :key="p"
      type="button"
      class="power flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold ring-1 transition"
      :class="`power-${state(p)}`"
      :disabled="state(p) !== 'ready' || busy !== null"
      :aria-pressed="state(p) === 'active'"
      :title="t(`game.powerUps.${p}Help`)"
      @click="use(p)"
    >
      <span class="text-base" aria-hidden="true">{{ ICONS[p] }}</span>
      <span>{{ t(`game.powerUps.${p}`) }}</span>
      <span v-if="state(p) === 'active'" class="text-xs" aria-hidden="true">✓</span>
    </button>
  </div>
</template>

<style scoped>
.power-ready {
  background: linear-gradient(135deg, rgb(139 92 246 / 0.35), rgb(236 72 153 / 0.35));
  color: white;
  --tw-ring-color: rgb(216 180 254 / 0.6);
  animation: power-glow 2.2s ease-in-out infinite;
}
.power-ready:hover {
  transform: translateY(-2px) scale(1.03);
}
.power-ready:active {
  transform: scale(0.95);
}
.power-active {
  background: linear-gradient(135deg, #f59e0b, #ec4899);
  color: white;
  --tw-ring-color: #fde68a;
  animation: power-on 0.6s cubic-bezier(0.2, 1.6, 0.4, 1) both, power-pulse 1.2s 0.6s ease-in-out infinite;
}
.power-used,
.power-unfit {
  background: rgb(255 255 255 / 0.05);
  color: rgb(255 255 255 / 0.35);
  --tw-ring-color: rgb(255 255 255 / 0.08);
}
.power-used span:first-child {
  filter: grayscale(1);
}
@keyframes power-glow {
  50% {
    box-shadow: 0 0 18px rgb(192 132 252 / 0.55);
  }
}
@keyframes power-on {
  from {
    transform: scale(0.6) rotate(-8deg);
  }
}
@keyframes power-pulse {
  50% {
    box-shadow: 0 0 22px rgb(251 191 36 / 0.7);
    transform: scale(1.04);
  }
}
@media (prefers-reduced-motion: reduce) {
  .power-ready,
  .power-active {
    animation: none;
  }
}
</style>
