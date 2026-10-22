<script setup lang="ts">
import { rankForLevel } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Mascot from '@/components/Mascot.vue';
import { useConfetti } from '@/composables/useConfetti';
import { useEmojiRain } from '@/composables/useEmojiRain';
import { sound } from '@/game/sound';

/**
 * A new wrestling title: Агу puts on the wrestler's hat and does the eagle
 * dance (дэвэх), like a Naadam champion, while the new title is announced.
 */
const props = defineProps<{ level: number }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const confetti = useConfetti();
const { rain } = useEmojiRain();

const rank = computed(() => rankForLevel(props.level));
const closeButton = ref<HTMLButtonElement | null>(null);

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close');
}

onMounted(() => {
  sound.play('drumroll');
  setTimeout(() => {
    sound.play('fanfare');
    confetti.celebrate();
    rain([rank.value.icon, '🏅', '✨']);
  }, 900);
  closeButton.value?.focus();
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div class="rank-up fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" :aria-label="t('rankUp.title')">
      <div class="rays" aria-hidden="true" />
      <div class="relative flex max-w-md flex-col items-center text-center text-white">
        <p class="kicker font-display text-lg font-bold uppercase tracking-[0.3em] text-amber-300">{{ t('rankUp.title') }}</p>
        <div class="dancer mt-2" aria-hidden="true">
          <span class="wing wing-left">🦅</span>
          <Mascot mood="celebrate" outfit="naadam" :size="190" />
          <span class="wing wing-right">🦅</span>
        </div>
        <div class="medal mt-2 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-5xl shadow-[0_0_60px_rgb(251_191_36/0.6)] ring-4 ring-amber-200/60">
          {{ rank.icon }}
        </div>
        <h2 class="title mt-4 font-display text-5xl font-bold text-amber-300 drop-shadow">{{ t(`ranks.${rank.code}`) }}</h2>
        <p class="subtitle mt-3 text-lg text-ink-100">{{ t('rankUp.text', { rank: t(`ranks.${rank.code}`), n: level }) }}</p>
        <button ref="closeButton" type="button" class="btn-primary subtitle mt-6 px-10 text-lg" @click="emit('close')">
          {{ t('rankUp.ok') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rank-up {
  animation: fade-in 0.3s ease both;
}
.rays {
  position: absolute;
  inset: -50%;
  background: repeating-conic-gradient(from 0deg, rgb(251 191 36 / 0.14) 0deg 10deg, transparent 10deg 20deg);
  animation: spin 24s linear infinite;
  mask-image: radial-gradient(circle, black 20%, transparent 60%);
}
.kicker {
  animation: drop-in 0.5s 0.2s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
/* Дэвэх: the wrestler's eagle dance — sway, rise on the toes, flap. */
.dancer {
  position: relative;
  display: flex;
  align-items: center;
  animation: devekh 1.6s ease-in-out infinite;
  transform-origin: 50% 100%;
}
.wing {
  font-size: 3.5rem;
  opacity: 0.9;
}
.wing-left {
  transform: scaleX(-1);
  animation: flap-left 0.8s ease-in-out infinite;
  transform-origin: 100% 60%;
}
.wing-right {
  animation: flap-right 0.8s ease-in-out infinite;
  transform-origin: 0% 60%;
}
.medal {
  animation: medal-pop 0.7s 0.9s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}
.title {
  animation: title-in 0.6s 1.1s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.subtitle {
  animation: fade-up 0.5s 1.4s ease both;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes drop-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
}
@keyframes devekh {
  0%,
  100% {
    transform: translateY(0) rotate(-6deg);
  }
  25% {
    transform: translateY(-14px) rotate(0deg);
  }
  50% {
    transform: translateY(0) rotate(6deg);
  }
  75% {
    transform: translateY(-14px) rotate(0deg);
  }
}
@keyframes flap-left {
  0%,
  100% {
    transform: scaleX(-1) rotate(0deg);
  }
  50% {
    transform: scaleX(-1) rotate(-28deg);
  }
}
@keyframes flap-right {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-28deg);
  }
}
@keyframes medal-pop {
  from {
    opacity: 0;
    transform: scale(0.2) rotate(-90deg);
  }
}
@keyframes title-in {
  from {
    opacity: 0;
    transform: scale(1.8);
    letter-spacing: 0.4em;
  }
}
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rank-up,
  .rays,
  .kicker,
  .dancer,
  .wing-left,
  .wing-right,
  .medal,
  .title,
  .subtitle {
    animation: none;
  }
}
</style>
