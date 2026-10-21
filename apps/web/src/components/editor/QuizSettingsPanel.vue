<script setup lang="ts">
import { LIMITS, SUPPORTED_LOCALES } from '@quiz/shared';
import { useI18n } from 'vue-i18n';
import { useFieldErrors } from '@/editor/useFieldErrors';
import { useEditorStore } from '@/stores/editor';
import ImageField from './ImageField.vue';

const editor = useEditorStore();
const { fieldError } = useFieldErrors();
const { t } = useI18n();
const languageNames = { mn: 'Монгол', en: 'English' } as const;
</script>

<template>
  <section class="card space-y-5 p-5" aria-labelledby="quiz-settings-title">
    <h2 id="quiz-settings-title" class="text-lg font-black">{{ t('editor.quizSettings') }}</h2>
    <label class="block">
      <span class="label">{{ t('editor.description') }} <span class="font-normal text-slate-400">({{ t('common.optional') }})</span></span>
      <textarea
        v-model="editor.draft.description"
        rows="3"
        class="input"
        :class="{ 'input-error': fieldError('description') }"
        :maxlength="LIMITS.descriptionMax"
      />
      <p v-if="fieldError('description')" class="field-error">{{ fieldError('description') }}</p>
    </label>
    <ImageField v-model="editor.draft.coverImageUrl" :label="t('editor.coverImage')" :error="fieldError('coverImageUrl')" />
    <label class="block">
      <span class="label">{{ t('editor.language') }}</span>
      <select v-model="editor.draft.language" class="input">
        <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">{{ languageNames[code] }}</option>
      </select>
    </label>
  </section>
</template>
