<script setup lang="ts">
import type { QuestionReveal } from '@quiz/shared';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';
import { useEmojiRain } from '@/composables/useEmojiRain';

/** The mascot comments on how the room did, on the host screen after each reveal. */
const props = defineProps<{ reveal: QuestionReveal; seed: number }>();
const { tm, rt } = useI18n();

/** Players who got it right, when the distribution tells us (not for multiple choice). */
const correctCount = computed<number | null>(() => {
  const { answer, distribution } = props.reveal;
  if (answer.type === 'single' || answer.type === 'image') return distribution[answer.optionIds[0]!] ?? 0;
  if (answer.type === 'true_false') return distribution[String(answer.value)] ?? 0;
  if (answer.type === 'type_answer' || answer.type === 'ordering') return distribution.correct ?? 0;
  return null;
});

const tier = computed<'none' | 'all' | 'most' | 'half' | 'few' | 'unknown'>(() => {
  const { answeredCount, playerCount } = props.reveal;
  if (answeredCount === 0) return 'none';
  if (correctCount.value === null || playerCount === 0) return 'unknown';
  const share = correctCount.value / playerCount;
  if (share >= 1) return 'all';
  if (share >= 0.7) return 'most';
  if (share >= 0.35) return 'half';
  return 'few';
});

const mood = computed<MascotMood>(
  () => ({ none: 'sleepy', all: 'cool', most: 'happy', half: 'thinking', few: 'dizzy', unknown: 'happy' })[tier.value] as MascotMood,
);

// A perfect question deserves a party on the big screen.
const { rain } = useEmojiRain();
onMounted(() => {
  if (tier.value === 'all') rain(['🎉', '⭐', '👏', '🥳']);
});

const line = computed(() => {
  const list = tm(`game.revealComments.${tier.value}`) as unknown[];
  if (!Array.isArray(list) || list.length === 0) return '';
  return rt(list[props.seed % list.length] as Parameters<typeof rt>[0]);
});
</script>

<template>
  <div class="flex items-end justify-center">
    <Mascot :mood="mood" :size="96" :say="line" />
  </div>
</template>
