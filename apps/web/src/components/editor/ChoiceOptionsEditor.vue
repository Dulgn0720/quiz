<script setup lang="ts">
import { LIMITS } from '@quiz/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { createOption, toggleCorrect, type DraftQuestion } from '@/editor/draft';
import { useFieldErrors } from '@/editor/useFieldErrors';
import ImageField from './ImageField.vue';

const props = defineProps<{ question: DraftQuestion; path: string }>();
const { fieldError } = useFieldErrors();
const { t } = useI18n();

const multiple = computed(() => props.question.type === 'multiple');
/** Kahoot-style colours so answers are easy to tell apart on the big screen. */
const colors = ['bg-red-500', 'bg-blue-500', 'bg-amber-500', 'bg-emerald-500', 'bg-fuchsia-500', 'bg-cyan-500'];

function removeOption(index: number): void {
  const [removed] = props.question.options.splice(index, 1);
  if (removed) props.question.correct = props.question.correct.filter((id) => id !== removed.id);
}
</script>

<template>
  <fieldset>
    <legend class="label">{{ t('question.options') }}</legend>
    <p class="mb-3 text-sm text-slate-500">
      {{ multiple ? t('question.correctHintMultiple') : t('question.correctHintSingle') }}
    </p>
    <ul class="grid gap-3 sm:grid-cols-2">
      <li
        v-for="(option, i) in question.options"
        :key="option.id"
        class="flex flex-col gap-2 rounded-xl border-2 p-2 transition"
        :class="question.correct.includes(option.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'"
      >
        <div class="flex items-center gap-2">
          <span class="h-9 w-2 shrink-0 rounded-full" :class="colors[i % colors.length]" aria-hidden="true" />
          <input
            v-model="option.text"
            class="input min-w-0 flex-1"
            :class="{ 'input-error': fieldError(`${path}.options.${i}.text`) }"
            :placeholder="t('question.optionPlaceholder', { n: i + 1 })"
            :maxlength="LIMITS.optionTextMax"
          />
          <button
            type="button"
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-lg font-black transition"
            :class="
              question.correct.includes(option.id)
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 text-transparent hover:border-emerald-400'
            "
            :role="multiple ? 'checkbox' : 'radio'"
            :aria-checked="question.correct.includes(option.id)"
            :aria-label="`${t('question.markCorrect')}: ${option.text || t('question.optionPlaceholder', { n: i + 1 })}`"
            @click="toggleCorrect(question, option.id)"
          >
            ✓
          </button>
        </div>
        <div class="flex items-center gap-2 pl-4">
          <ImageField v-model="option.imageUrl" :label="t('question.optionImage')" compact class="flex-1" />
          <button
            type="button"
            class="btn-icon"
            :disabled="question.options.length <= LIMITS.optionsMin"
            :aria-label="`${t('common.remove')} ${i + 1}`"
            @click="removeOption(i)"
          >
            ✕
          </button>
        </div>
        <p v-if="fieldError(`${path}.options.${i}.text`)" class="field-error">
          {{ fieldError(`${path}.options.${i}.text`) }}
        </p>
      </li>
    </ul>
    <button
      v-if="question.options.length < LIMITS.optionsMax"
      type="button"
      class="btn-ghost mt-3"
      @click="question.options.push(createOption())"
    >
      ＋ {{ t('question.addOption') }}
    </button>
    <p v-if="fieldError(`${path}.correct`)" class="field-error">{{ fieldError(`${path}.correct`) }}</p>
    <p v-if="fieldError(`${path}.options`)" class="field-error">{{ fieldError(`${path}.options`) }}</p>
  </fieldset>
</template>
