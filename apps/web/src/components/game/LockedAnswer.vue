<script setup lang="ts">
import type { AnswerPayload, QuestionPublic } from '@quiz/shared';
import { computed } from 'vue';
import Mascot from '@/components/Mascot.vue';
import { tileStyle } from '@/game/answers';

/** Echoes what the player chose, so they know the tap registered on the right answer. */
const props = defineProps<{ question: QuestionPublic; answer: AnswerPayload }>();

const options = computed(() => {
  if (!('options' in props.question) || !('optionIds' in props.answer)) return [];
  const ids = props.answer.optionIds;
  return props.question.options.map((option, index) => ({ option, index })).filter(({ option }) => ids.includes(option.id));
});

const items = computed(() => {
  if (props.question.type !== 'ordering' || props.answer.type !== 'ordering') return [];
  const byId = new Map(props.question.items.map((item) => [item.id, item]));
  return props.answer.itemIds.map((id) => byId.get(id)).filter((item) => item !== undefined);
});
</script>

<template>
  <div class="card flex animate-pop flex-col items-center px-6 py-10 text-center" role="status">
    <Mascot mood="cool" :size="96" />
    <p class="mt-3 font-display text-xl font-bold">{{ $t('game.player.answerLocked') }}</p>
    <p class="mt-1 font-semibold text-slate-400">{{ $t('game.player.waitingForOthers') }}</p>

    <p class="mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">{{ $t('game.player.yourAnswer') }}</p>
    <ul v-if="options.length" class="mt-2 flex flex-wrap justify-center gap-2">
      <li
        v-for="{ option, index } in options"
        :key="option.id"
        class="flex items-center gap-2 rounded-2xl px-4 py-2 text-lg font-extrabold shadow-lg"
        :class="[tileStyle(index).bg, tileStyle(index).fg]"
      >
        <span aria-hidden="true">{{ tileStyle(index).shape }}</span> {{ option.text }}
      </li>
    </ul>
    <p
      v-else-if="answer.type === 'true_false'"
      class="mt-2 rounded-2xl px-5 py-2 text-lg font-extrabold text-white shadow-lg"
      :class="answer.value ? 'bg-gradient-to-br from-sky-600 to-blue-700' : 'bg-gradient-to-br from-rose-600 to-pink-700'"
    >
      <span aria-hidden="true">{{ answer.value ? '✓' : '✕' }}</span> {{ answer.value ? $t('question.true') : $t('question.false') }}
    </p>
    <p v-else-if="answer.type === 'type_answer'" class="mt-2 rounded-2xl bg-white/10 px-5 py-2 text-xl font-bold">«{{ answer.text }}»</p>
    <ol v-else-if="items.length" class="mt-2 flex w-full max-w-xs flex-col gap-1 text-left">
      <li v-for="(item, i) in items" :key="item.id" class="rounded-xl bg-white/10 px-3 py-1.5 font-semibold">
        <span class="font-display tabular-nums">{{ i + 1 }}.</span> {{ item.text }}
      </li>
    </ol>
  </div>
</template>
