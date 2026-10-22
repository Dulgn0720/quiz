<script setup lang="ts">
import { LIMITS, ROUND_TYPES } from '@quiz/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFieldErrors } from '@/editor/useFieldErrors';
import { useEditorStore } from '@/stores/editor';

const props = defineProps<{ roundIndex: number }>();
const editor = useEditorStore();
const { fieldError } = useFieldErrors();
const { t } = useI18n();

const round = computed(() => editor.draft.rounds[props.roundIndex]!);
const path = (field: string) => `rounds.${props.roundIndex}.${field}`;

function remove(): void {
  const r = round.value;
  if (window.confirm(t('editor.deleteRoundConfirm', { name: r.name || '—', n: r.questions.length }))) {
    editor.removeRound(props.roundIndex);
  }
}
</script>

<template>
  <section class="card space-y-5 p-5" aria-labelledby="round-settings-title">
    <div class="flex items-center gap-2">
      <h2 id="round-settings-title" class="mr-auto text-lg font-black">{{ t('editor.roundSettings') }}</h2>
      <button
        type="button"
        class="btn-danger"
        :disabled="editor.draft.rounds.length <= 1"
        @click="remove"
      >
        {{ t('editor.deleteRound') }}
      </button>
    </div>

    <label class="block">
      <span class="label">{{ t('round.name') }}</span>
      <input
        v-model="round.name"
        class="input"
        :class="{ 'input-error': fieldError(path('name')) }"
        :maxlength="LIMITS.roundNameMax"
      />
      <p v-if="fieldError(path('name'))" class="field-error">{{ fieldError(path('name')) }}</p>
    </label>

    <fieldset>
      <legend class="label">{{ t('round.type') }}</legend>
      <div class="grid gap-2 sm:grid-cols-2">
        <label
          v-for="type in ROUND_TYPES"
          :key="type"
          class="flex cursor-pointer gap-3 rounded-xl border-2 p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-200"
          :class="round.type === type ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'"
        >
          <input v-model="round.type" type="radio" :value="type" class="sr-only" :name="`round-type-${round.key}`" />
          <span>
            <span class="block font-bold">{{ t(`round.types.${type}`) }}</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400">{{ t(`round.typeHelp.${type}`) }}</span>
          </span>
        </label>
      </div>
    </fieldset>

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="label">{{ t('round.timePerQuestion') }} ({{ t('common.seconds') }})</span>
        <input
          v-model.number="round.timePerQuestion"
          type="number"
          inputmode="numeric"
          class="input"
          :class="{ 'input-error': fieldError(path('timePerQuestion')) }"
          :min="LIMITS.timeMin"
          :max="LIMITS.timeMax"
        />
        <p v-if="fieldError(path('timePerQuestion'))" class="field-error">{{ fieldError(path('timePerQuestion')) }}</p>
      </label>
      <label class="block">
        <span class="label">{{ t('round.pointsMultiplier') }}</span>
        <input
          v-model.number="round.pointsMultiplier"
          type="number"
          inputmode="decimal"
          step="0.5"
          class="input"
          :class="{ 'input-error': fieldError(path('pointsMultiplier')) }"
          :min="LIMITS.multiplierMin"
          :max="LIMITS.multiplierMax"
        />
        <p v-if="fieldError(path('pointsMultiplier'))" class="field-error">{{ fieldError(path('pointsMultiplier')) }}</p>
      </label>
    </div>

    <div class="space-y-2">
      <label class="flex min-h-11 cursor-pointer items-center gap-3">
        <input v-model="round.shuffleQuestions" type="checkbox" class="h-5 w-5 rounded accent-brand-600" />
        <span class="font-semibold">{{ t('round.shuffleQuestions') }}</span>
      </label>
      <label class="flex min-h-11 cursor-pointer items-center gap-3">
        <input v-model="round.shuffleAnswers" type="checkbox" class="h-5 w-5 rounded accent-brand-600" />
        <span class="font-semibold">{{ t('round.shuffleAnswers') }}</span>
      </label>
    </div>
  </section>
</template>
