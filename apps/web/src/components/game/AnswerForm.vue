<script setup lang="ts">
import type { AnswerPayload, OrderingItem, QuestionPublic } from '@quiz/shared';
import { computed, ref, watch } from 'vue';
import { tileStyle } from '@/game/answers';

/** Answer input on the player's phone, for every question type. */
const props = defineProps<{ question: QuestionPublic; disabled?: boolean }>();
const emit = defineEmits<{ submit: [answer: AnswerPayload] }>();

const selected = ref<string[]>([]);
const text = ref('');
const order = ref<OrderingItem[]>([]);

watch(
  () => props.question.globalIndex,
  () => {
    selected.value = [];
    text.value = '';
    order.value = props.question.type === 'ordering' ? [...props.question.items] : [];
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

function submitOrder(): void {
  emit('submit', { type: 'ordering', itemIds: order.value.map((i) => i.id) });
}
</script>

<template>
  <form class="flex flex-1 flex-col gap-3" @submit.prevent>
    <template v-if="'options' in question">
      <p v-if="isMultiple" class="text-center text-sm font-bold text-slate-600 dark:text-slate-300">
        {{ $t('game.question.selectAll', { n: question.correctCount }) }}
      </p>
      <div class="grid flex-1 grid-cols-2 gap-3">
        <button
          v-for="(option, i) in question.options"
          :key="option.id"
          type="button"
          class="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl p-3 text-lg font-extrabold shadow-lg transition duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60"
          :class="[
            tileStyle(i).bg,
            tileStyle(i).fg,
            tileStyle(i).ring,
            selected.includes(option.id) ? 'scale-[0.97] ring-4 ring-white ring-offset-4 ring-offset-ink-950' : '',
          ]"
          :aria-pressed="isMultiple ? selected.includes(option.id) : undefined"
          :disabled="disabled"
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
        :class="value ? 'bg-gradient-to-br from-sky-500 to-blue-600 ring-sky-300' : 'bg-gradient-to-br from-rose-500 to-pink-600 ring-rose-300'"
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

    <div v-else-if="question.type === 'ordering'" class="flex flex-col gap-3">
      <p class="text-center text-sm font-bold text-slate-600 dark:text-slate-300">{{ $t('game.question.orderHint') }}</p>
      <TransitionGroup tag="ol" class="flex flex-col gap-2" move-class="transition-transform duration-200">
        <li v-for="(item, i) in order" :key="item.id" class="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 p-2 pl-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
          <span class="font-black tabular-nums text-slate-400">{{ i + 1 }}</span>
          <span class="flex-1 font-bold">{{ item.text }}</span>
          <button type="button" class="btn-icon" :disabled="disabled || i === 0" :aria-label="$t('common.moveUp')" @click="move(i, -1)">↑</button>
          <button type="button" class="btn-icon" :disabled="disabled || i === order.length - 1" :aria-label="$t('common.moveDown')" @click="move(i, 1)">↓</button>
        </li>
      </TransitionGroup>
      <button type="button" class="btn-primary py-4 text-lg" :disabled="disabled" @click="submitOrder">
        {{ $t('game.question.submit') }}
      </button>
    </div>
  </form>
</template>
