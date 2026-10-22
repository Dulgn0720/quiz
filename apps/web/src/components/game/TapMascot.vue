<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';
import { sound } from '@/game/sound';

/** A little lobby toy: tap the mascot while you wait. Every tenth tap gets a celebration. */
const props = withDefaults(defineProps<{ size?: number }>(), { size: 140 });

const taps = ref(0);
const bouncing = ref(false);
const party = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

const mood = computed<MascotMood>(() => (party.value ? 'celebrate' : bouncing.value ? 'happy' : 'wave'));

function tap(): void {
  taps.value += 1;
  clearTimeout(timer);
  if (taps.value % 10 === 0) {
    party.value = true;
    sound.play('sparkle');
    navigator.vibrate?.([20, 40, 20]);
    timer = setTimeout(() => (party.value = false), 2200);
    return;
  }
  bouncing.value = true;
  sound.play('boing');
  navigator.vibrate?.(10);
  timer = setTimeout(() => (bouncing.value = false), 700);
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="flex flex-col items-center">
    <button
      type="button"
      class="relative rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-400 active:scale-90"
      :aria-label="$t('mascot.tap')"
      @click="tap"
    >
      <Mascot :mood="mood" :size="props.size" />
      <slot />
    </button>
    <p class="mt-1 h-5 text-sm font-bold text-brand-300" aria-live="polite">
      <template v-if="party">{{ $t('mascot.tapParty') }}</template>
      <template v-else-if="taps > 0">{{ $t('mascot.taps', { n: taps }) }}</template>
      <template v-else>{{ $t('mascot.tapHint') }}</template>
    </p>
  </div>
</template>
