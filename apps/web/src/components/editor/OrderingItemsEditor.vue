<script setup lang="ts">
import { LIMITS } from '@quiz/shared';
import { useI18n } from 'vue-i18n';
import { createItem, moveItem, type DraftQuestion } from '@/editor/draft';
import { useFieldErrors } from '@/editor/useFieldErrors';

defineProps<{ question: DraftQuestion; path: string }>();
const { fieldError } = useFieldErrors();
const { t } = useI18n();
</script>

<template>
  <fieldset>
    <legend class="label">{{ t('question.items') }}</legend>
    <p class="mb-3 text-sm text-slate-500">{{ t('question.orderingHint') }}</p>
    <ol class="space-y-2">
      <li v-for="(item, i) in question.items" :key="item.id" class="flex items-center gap-2">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 font-black text-brand-700">
          {{ i + 1 }}
        </span>
        <input
          v-model="item.text"
          class="input min-w-0 flex-1"
          :class="{ 'input-error': fieldError(`${path}.items.${i}.text`) }"
          :placeholder="t('question.itemPlaceholder', { n: i + 1 })"
          :maxlength="LIMITS.optionTextMax"
        />
        <button type="button" class="btn-icon" :disabled="i === 0" :aria-label="t('common.moveUp')" @click="moveItem(question.items, i, i - 1)">↑</button>
        <button
          type="button"
          class="btn-icon"
          :disabled="i === question.items.length - 1"
          :aria-label="t('common.moveDown')"
          @click="moveItem(question.items, i, i + 1)"
        >
          ↓
        </button>
        <button
          type="button"
          class="btn-icon"
          :disabled="question.items.length <= LIMITS.orderingItemsMin"
          :aria-label="`${t('common.remove')} ${i + 1}`"
          @click="question.items.splice(i, 1)"
        >
          ✕
        </button>
      </li>
    </ol>
    <button
      v-if="question.items.length < LIMITS.orderingItemsMax"
      type="button"
      class="btn-ghost mt-3"
      @click="question.items.push(createItem())"
    >
      ＋ {{ t('question.addItem') }}
    </button>
    <p v-if="fieldError(`${path}.items`)" class="field-error">{{ fieldError(`${path}.items`) }}</p>
  </fieldset>
</template>
