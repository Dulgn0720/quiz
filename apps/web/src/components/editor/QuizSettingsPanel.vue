<script setup lang="ts">
import { LIMITS, QUIZ_CATEGORIES, SUPPORTED_LOCALES } from '@quiz/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFieldErrors } from '@/editor/useFieldErrors';
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import ImageField from './ImageField.vue';

const editor = useEditorStore();
const { fieldError } = useFieldErrors();
const { t } = useI18n();
const languageNames = { mn: 'Монгол', en: 'English' } as const;
const auth = useAuthStore();
/** The «Агула» shelf is for official company quizzes, so only admins may pick it. */
const categories = computed(() =>
  QUIZ_CATEGORIES.filter((c) => c !== 'agula' || auth.user?.isAdmin || editor.draft.category === 'agula'),
);
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
    <fieldset>
      <legend class="label">{{ t('editor.visibility') }}</legend>
      <div v-if="auth.user" class="grid gap-2 sm:grid-cols-2">
        <label
          v-for="option in (['private', 'public'] as const)"
          :key="option"
          class="flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition"
          :class="
            editor.draft.visibility === option
              ? 'bg-brand-500/10 ring-2 ring-brand-500'
              : 'ring-slate-200 hover:bg-slate-50 dark:ring-white/10 dark:hover:bg-white/5'
          "
        >
          <input v-model="editor.draft.visibility" type="radio" name="visibility" :value="option" class="mt-1 accent-brand-500" />
          <span>
            <span class="block font-bold">{{ option === 'public' ? '🌍' : '🔒' }} {{ t(`editor.visibilityOptions.${option}`) }}</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400">{{ t(`editor.visibilityHelp.${option}`) }}</span>
          </span>
        </label>
      </div>
      <p v-else class="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
        🌍 {{ t('editor.visibilityGuest') }}
      </p>
    </fieldset>
    <label class="block">
      <span class="label">{{ t('editor.category') }}</span>
      <select v-model="editor.draft.category" class="input">
        <option v-for="code in categories" :key="code" :value="code">{{ t(`categories.${code}.icon`) }} {{ t(`categories.${code}.name`) }}</option>
      </select>
    </label>
    <label class="block">
      <span class="label">{{ t('editor.language') }}</span>
      <select v-model="editor.draft.language" class="input">
        <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">{{ languageNames[code] }}</option>
      </select>
    </label>
  </section>
</template>
