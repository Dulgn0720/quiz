<script setup lang="ts">
import type { QuestionPublic, QuestionReveal } from '@quiz/shared';
import { computed } from 'vue';
import { tileStyle } from '@/game/answers';
import Mascot, { type MascotMood } from '@/components/Mascot.vue';
import { useCountdown } from '@/game/useCountdown';
import GameTimer from './GameTimer.vue';
import QuestionHeader from './QuestionHeader.vue';

/** The question on the shared (projector) screen. With `reveal`, correct answers are highlighted. */
const props = defineProps<{
  question: QuestionPublic;
  reveal?: QuestionReveal;
  answered?: number;
  total?: number;
}>();

const correctIds = computed(() =>
  props.reveal && 'optionIds' in props.reveal.answer ? new Set(props.reveal.answer.optionIds) : new Set<string>(),
);
// The mascot watches the clock with the room: calm at first, nervous in the last seconds, happy when everyone has answered.
const { seconds } = useCountdown(
  () => props.question.endsAt,
  () => props.question.pausedRemainingMs,
);
const watcherMood = computed<MascotMood>(() => {
  if (props.question.pausedRemainingMs !== undefined) return 'sleepy';
  if (props.total && props.answered === props.total) return 'happy';
  return seconds.value <= 5 ? 'nervous' : 'thinking';
});

const trueFalseAnswer = computed(() =>
  props.reveal?.answer.type === 'true_false' ? props.reveal.answer.value : undefined,
);
</script>

<template>
  <div class="flex flex-col" :class="reveal ? 'gap-4' : 'gap-6'">
    <QuestionHeader :question="question" />
    <div class="flex items-start gap-4">
      <h2 class="flex-1 text-balance text-center text-3xl font-bold leading-tight" :class="reveal ? 'sm:text-4xl' : 'sm:text-5xl'">
        {{ question.prompt }}
      </h2>
    </div>
    <p v-if="question.type === 'multiple' && !reveal" class="text-center text-2xl font-bold text-amber-300">
      <span aria-hidden="true">☑</span> {{ $t('game.question.selectAll', { n: question.correctCount }) }}
    </p>

    <div class="flex items-center justify-center gap-6">
      <GameTimer
        v-if="!reveal"
        :ends-at="question.endsAt"
        :paused-remaining-ms="question.pausedRemainingMs"
        :total="question.timeLimit"
        size="lg"
      />
      <img
        v-if="question.imageUrl"
        :src="question.imageUrl"
        alt=""
        class="max-h-[38vh] max-w-full rounded-2xl object-contain shadow"
      />
      <Mascot v-if="!reveal && total !== undefined" :mood="watcherMood" :size="96" class="hidden sm:inline-flex" />
      <div v-if="!reveal && total !== undefined" class="text-center" aria-live="polite">
        <p class="text-5xl font-black tabular-nums">{{ answered }}</p>
        <p class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ $t('game.question.answers', { total }) }}</p>
      </div>
    </div>

    <ul v-if="'options' in question" class="grid gap-3 sm:grid-cols-2">
      <li
        v-for="(option, i) in question.options"
        :key="option.id"
        class="flex items-center gap-4 rounded-3xl px-6 text-xl font-extrabold shadow-xl transition duration-500 sm:text-2xl"
        :class="[
          tileStyle(i).bg,
          tileStyle(i).fg,
          reveal ? 'min-h-16 py-3' : 'min-h-24 py-4',
          reveal && !correctIds.has(option.id) ? 'scale-[0.98] opacity-25 saturate-50' : '',
        ]"
      >
        <span class="text-3xl" aria-hidden="true">{{ tileStyle(i).shape }}</span>
        <img v-if="option.imageUrl" :src="option.imageUrl" alt="" class="h-16 w-16 rounded-lg bg-white dark:bg-slate-900 object-contain" />
        <span class="flex-1">{{ option.text }}</span>
        <span v-if="reveal && correctIds.has(option.id)" class="text-3xl">
          <span aria-hidden="true">✔</span><span class="sr-only">{{ $t('game.reveal.correct') }}</span>
        </span>
        <span v-if="reveal" class="min-w-10 rounded-full bg-black/20 px-3 py-1 text-center font-display text-xl tabular-nums">
          {{ reveal.distribution[option.id] ?? 0 }}
        </span>
      </li>
    </ul>

    <ul v-else-if="question.type === 'true_false'" class="grid grid-cols-2 gap-3">
      <li
        v-for="value in [true, false]"
        :key="String(value)"
        class="flex min-h-24 items-center justify-center gap-3 rounded-3xl text-3xl font-extrabold text-white shadow-xl"
        :class="[
          value ? 'bg-gradient-to-br from-sky-600 to-blue-700' : 'bg-gradient-to-br from-rose-600 to-pink-700',
          trueFalseAnswer !== undefined && trueFalseAnswer !== value ? 'opacity-25 saturate-50' : '',
        ]"
      >
        <span aria-hidden="true">{{ value ? '✓' : '✕' }}</span>
        {{ value ? $t('question.true') : $t('question.false') }}
      </li>
    </ul>

    <ol v-else-if="question.type === 'ordering' && !reveal" class="mx-auto flex w-full max-w-xl flex-col gap-2">
      <li v-for="item in question.items" :key="item.id" class="rounded-2xl bg-white px-6 py-4 text-2xl font-bold shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10">
        {{ item.text }}
      </li>
    </ol>

    <p v-else-if="question.type === 'type_answer' && !reveal" class="text-center text-xl font-bold text-slate-500 dark:text-slate-400">
      ⌨️ {{ $t('game.question.typeOnDevice') }}
    </p>
  </div>
</template>
