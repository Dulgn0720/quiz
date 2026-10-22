<script setup lang="ts">
import type { AnswerPayload, OrderingItem, QuestionPublic } from '@quiz/shared';
import { computed, ref, watch } from 'vue';
import { tileStyle } from '@/game/answers';
import { formatNumber } from '@/game/numbers';

/** Answer input on the player's phone, for every question type. */
const props = defineProps<{ question: QuestionPublic; disabled?: boolean; hidden?: string[] }>();
const emit = defineEmits<{ submit: [answer: AnswerPayload] }>();

const selected = ref<string[]>([]);
const text = ref('');
const order = ref<OrderingItem[]>([]);
const guess = ref(0);

watch(
  () => props.question.globalIndex,
  () => {
    selected.value = [];
    text.value = '';
    order.value = props.question.type === 'ordering' ? [...props.question.items] : [];
    if (props.question.type === 'estimate') guess.value = snap((props.question.min + props.question.max) / 2);
  },
  { immediate: true },
);

const isMultiple = computed(() => props.question.type === 'multiple');

function pick(optionId: string): void {
  if (props.disabled) return;
  const q = props.question;
  if (q.type === 'single' || q.type === 'image') {
    emit('submit', { type: q.type, optionIds: [optionId] });
    return;
  }
  selected.value = selected.value.includes(optionId)
    ? selected.value.filter((id) => id !== optionId)
    : [...selected.value, optionId];
}

function submitMultiple(): void {
  if (selected.value.length > 0) emit('submit', { type: 'multiple', optionIds: selected.value });
}

function submitText(): void {
  if (text.value.trim()) emit('submit', { type: 'type_answer', text: text.value });
}

function move(index: number, delta: -1 | 1): void {
  const target = index + delta;
  if (target < 0 || target >= order.value.length) return;
  const next = [...order.value];
  [next[index], next[target]] = [next[target]!, next[index]!];
  order.value = next;
}

/** Rounds to the slider's step and keeps the value inside its range. */
function snap(value: number): number {
  const q = props.question;
  if (q.type !== 'estimate') return value;
  const stepped = Math.round((value - q.min) / q.step) * q.step + q.min;
  return Math.min(q.max, Math.max(q.min, Number(stepped.toFixed(6))));
}

function nudge(direction: -1 | 1): void {
  if (props.question.type === 'estimate') guess.value = snap(guess.value + direction * props.question.step);
}

function submitGuess(): void {
  emit('submit', { type: 'estimate', value: snap(guess.value) });
}

function submitOrder(): void {
  emit('submit', { type: 'ordering', itemIds: order.value.map((i) => i.id) });
}
</script>

<template>
  <form class="flex flex-1 flex-col gap-3" @submit.prevent>
    <template v-if="'options' in question">
      <p v-if="isMultiple" class="mx-auto w-fit rounded-full bg-amber-400/15 px-4 py-1.5 text-center text-base font-bold text-amber-700 dark:text-amber-200">
        {{ $t('game.question.selectAll', { n: question.correctCount }) }}
      </p>
      <div class="grid flex-1 grid-cols-2 gap-3">
        <button
          v-for="(option, i) in question.options"
          :key="option.id"
          type="button"
          class="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl p-3 text-lg font-extrabold shadow-lg transition duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60"
          :class="[
            hidden?.includes(option.id) ? 'fifty-gone' : '',
            tileStyle(i).bg,
            tileStyle(i).fg,
            tileStyle(i).ring,
            selected.includes(option.id) ? 'scale-[0.97] ring-4 ring-white ring-offset-4 ring-offset-ink-950' : '',
          ]"
          :aria-pressed="isMultiple ? selected.includes(option.id) : undefined"
          :disabled="disabled || hidden?.includes(option.id)"
          :aria-hidden="hidden?.includes(option.id) ? 'true' : undefined"
          @click="pick(option.id)"
        >
          <span class="text-2xl" aria-hidden="true">{{ tileStyle(i).shape }}</span>
          <img v-if="option.imageUrl" :src="option.imageUrl" alt="" class="max-h-20 rounded-lg bg-white dark:bg-slate-900 object-contain" />
          <span class="leading-tight">{{ option.text }}</span>
        </button>
      </div>
      <button v-if="isMultiple" type="button" class="btn-primary py-4 text-lg" :disabled="disabled || selected.length === 0" @click="submitMultiple">
        {{ $t('game.question.submit') }}
      </button>
    </template>

    <div v-else-if="question.type === 'true_false'" class="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        v-for="value in [true, false]"
        :key="String(value)"
        type="button"
        class="flex min-h-32 items-center justify-center gap-3 rounded-3xl text-3xl font-extrabold text-white shadow-lg transition duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60"
        :class="value ? 'bg-gradient-to-br from-sky-600 to-blue-700 ring-sky-300' : 'bg-gradient-to-br from-rose-600 to-pink-700 ring-rose-300'"
        :disabled="disabled"
        @click="emit('submit', { type: 'true_false', value })"
      >
        <span aria-hidden="true">{{ value ? '✓' : '✕' }}</span>
        {{ value ? $t('question.true') : $t('question.false') }}
      </button>
    </div>

    <div v-else-if="question.type === 'type_answer'" class="flex flex-col gap-3">
      <label class="sr-only" for="typed-answer">{{ $t('game.question.typePlaceholder') }}</label>
      <input
        id="typed-answer"
        v-model="text"
        class="input py-4 text-center text-2xl font-bold"
        :placeholder="$t('game.question.typePlaceholder')"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        maxlength="100"
        :disabled="disabled"
        @keydown.enter.prevent="submitText"
      />
      <button type="button" class="btn-primary py-4 text-lg" :disabled="disabled || !text.trim()" @click="submitText">
        {{ $t('game.question.submit') }}
      </button>
    </div>

    <div v-else-if="question.type === 'estimate'" class="flex flex-col gap-5">
      <p class="text-center text-base font-bold text-slate-600 dark:text-slate-300">{{ $t('game.question.estimateHint') }}</p>
      <output class="estimate-value mx-auto font-display text-6xl font-bold tabular-nums" aria-live="polite">
        {{ formatNumber(guess) }}<span v-if="question.unit" class="ml-2 text-2xl text-slate-400">{{ question.unit }}</span>
      </output>
      <div class="flex items-center gap-3">
        <button type="button" class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl font-black transition active:scale-90 disabled:opacity-30" :disabled="disabled || guess <= question.min" :aria-label="$t('game.question.less')" @click="nudge(-1)">−</button>
        <input
          v-model.number="guess"
          type="range"
          class="estimate-range h-3 flex-1 cursor-pointer"
          :min="question.min"
          :max="question.max"
          :step="question.step"
          :disabled="disabled"
          :aria-label="$t('game.question.estimateHint')"
        />
        <button type="button" class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl font-black transition active:scale-90 disabled:opacity-30" :disabled="disabled || guess >= question.max" :aria-label="$t('game.question.more')" @click="nudge(1)">+</button>
      </div>
      <div class="-mt-3 flex justify-between px-16 text-sm font-bold tabular-nums text-slate-400">
        <span>{{ formatNumber(question.min) }}</span>
        <span>{{ formatNumber(question.max) }}</span>
      </div>
      <button type="button" class="btn-primary py-4 text-lg" :disabled="disabled" @click="submitGuess">
        {{ $t('game.question.submit') }}
      </button>
    </div>

    <div v-else-if="question.type === 'ordering'" class="flex flex-col gap-3">
      <p class="text-center text-base font-bold text-slate-600 dark:text-slate-300">{{ $t('game.question.orderHint') }}</p>
      <TransitionGroup tag="ol" class="flex flex-col gap-2" move-class="transition-transform duration-200">
        <li v-for="(item, i) in order" :key="item.id" class="flex items-center gap-2 rounded-2xl bg-white py-1 pl-4 pr-1 shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.06] dark:ring-white/10">
          <span class="font-display font-bold tabular-nums text-slate-400">{{ i + 1 }}</span>
          <span class="flex-1 text-lg font-bold">{{ item.text }}</span>
          <button type="button" class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl font-black text-slate-700 transition active:scale-95 disabled:opacity-20 dark:bg-white/10 dark:text-white dark:active:bg-white/20" :disabled="disabled || i === 0" :aria-label="$t('common.moveUp')" @click="move(i, -1)">↑</button>
          <button type="button" class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl font-black text-slate-700 transition active:scale-95 disabled:opacity-20 dark:bg-white/10 dark:text-white dark:active:bg-white/20" :disabled="disabled || i === order.length - 1" :aria-label="$t('common.moveDown')" @click="move(i, 1)">↓</button>
        </li>
      </TransitionGroup>
      <button type="button" class="btn-primary py-4 text-lg" :disabled="disabled" @click="submitOrder">
        {{ $t('game.question.submit') }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.estimate-range {
  accent-color: #f57c14;
}
.estimate-value {
  text-shadow: 0 0 30px rgb(245 124 20 / 0.45);
}
/* Options removed by 50/50 crumple away but keep their place in the grid. */
.fifty-gone {
  animation: fifty-poof 0.55s cubic-bezier(0.5, 0, 0.75, 0) forwards;
  pointer-events: none;
}
@keyframes fifty-poof {
  30% {
    transform: scale(1.06) rotate(-3deg);
    filter: brightness(1.4);
  }
  100% {
    transform: scale(0.2) rotate(14deg);
    opacity: 0;
    filter: blur(6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .fifty-gone {
    animation: none;
    opacity: 0;
  }
}
</style>
