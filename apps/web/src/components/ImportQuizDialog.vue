<script setup lang="ts">
import { CSV_COLUMNS, quizToCsv, quizInputSchema, type ImportIssue, type QuizDetail } from '@quiz/shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ApiError } from '@/api/client';
import { quizzesApi } from '@/api/quizzes';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; imported: [quiz: QuizDetail] }>();
const { t } = useI18n();

/** Matches the API's limit on import content. */
const MAX_CHARS = 2_000_000;

const dialog = ref<HTMLDialogElement>();
const file = ref<File | null>(null);
const csvTitle = ref('');
const busy = ref(false);
const message = ref('');
const issues = ref<ImportIssue[]>([]);

const format = computed(() => {
  const name = file.value?.name.toLowerCase() ?? '';
  if (name.endsWith('.json')) return 'json' as const;
  if (name.endsWith('.csv')) return 'csv' as const;
  return null;
});

watch(
  () => props.open,
  (open) => {
    if (open) {
      file.value = null;
      csvTitle.value = '';
      message.value = '';
      issues.value = [];
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  message.value = '';
  issues.value = [];
  if (file.value && !format.value) message.value = t('importDialog.unsupported');
  if (file.value && format.value === 'csv' && !csvTitle.value) {
    csvTitle.value = file.value.name.replace(/\.csv$/i, '');
  }
}

async function submit(): Promise<void> {
  if (!file.value || !format.value) return;
  busy.value = true;
  message.value = '';
  issues.value = [];
  try {
    const content = await file.value.text();
    if (content.length > MAX_CHARS) {
      message.value = t('importDialog.tooLarge');
      return;
    }
    const quiz = await quizzesApi.import({
      format: format.value,
      content,
      title: format.value === 'csv' ? csvTitle.value : undefined,
    });
    emit('imported', quiz);
  } catch (error) {
    if (error instanceof ApiError && error.issues.length > 0) {
      message.value = t('importDialog.failed');
      issues.value = error.issues;
    } else if (error instanceof ApiError && error.isNetworkError) {
      message.value = t('common.networkError');
    } else {
      message.value = error instanceof Error ? error.message : t('common.error');
    }
  } finally {
    busy.value = false;
  }
}

function downloadTemplate(): void {
  // A tiny quiz showing every question type, exported with the real CSV writer.
  const example = quizInputSchema.parse({
    title: 'Template',
    rounds: [
      {
        name: 'Round 1',
        questions: [
          { type: 'single', prompt: '2 + 2 = ?', options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }], correct: ['b'] },
          {
            type: 'multiple',
            prompt: 'Which are even?',
            options: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }, { id: 'c', text: '4' }],
            correct: ['a', 'c'],
          },
          { type: 'true_false', prompt: 'The Earth is round.', correct: true },
          { type: 'type_answer', prompt: 'Capital of Mongolia?', acceptedAnswers: ['Ulaanbaatar', 'Улаанбаатар'] },
          { type: 'ordering', prompt: 'Smallest first', items: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }, { id: 'c', text: '3' }] },
          { type: 'estimate', prompt: 'Year of the People’s Revolution?', answer: 1921, min: 1900, max: 1950, tolerance: 2, unit: 'он' },
        ],
      },
    ],
  });
  const blob = new Blob([quizToCsv(example)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'quiz-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

const columnsHint = CSV_COLUMNS.join(', ');
</script>

<template>
  <dialog
    ref="dialog"
    class="w-[min(36rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/50"
    aria-labelledby="import-title"
    @close="emit('close')"
  >
    <form class="flex flex-col gap-4 p-6" @submit.prevent="submit">
      <h2 id="import-title" class="text-xl font-black">{{ t('importDialog.title') }}</h2>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ t('importDialog.help') }}</p>

      <label class="block">
        <span class="label">{{ t('importDialog.chooseFile') }}</span>
        <input
          type="file"
          accept=".json,.csv,application/json,text/csv"
          class="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand-100 file:px-4 file:py-2.5 file:font-bold file:text-brand-700 hover:file:bg-brand-200"
          @change="onFileChange"
        />
      </label>

      <label v-if="format === 'csv'" class="block">
        <span class="label">{{ t('importDialog.csvTitle') }}</span>
        <input v-model="csvTitle" class="input" maxlength="120" />
      </label>

      <button type="button" class="self-start text-sm font-bold text-brand-700 dark:text-brand-300 underline" :title="columnsHint" @click="downloadTemplate">
        {{ t('importDialog.downloadTemplate') }}
      </button>

      <div v-if="message" class="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300" role="alert">
        <p class="font-bold">{{ message }}</p>
        <ul v-if="issues.length" class="mt-2 max-h-48 list-disc space-y-1 overflow-auto pl-5">
          <li v-for="(issue, i) in issues" :key="i">
            <span v-if="issue.row" class="font-bold">{{ t('importDialog.row', { row: issue.row }) }}: </span>
            <span v-if="issue.path" class="font-mono text-xs">{{ issue.path }} — </span>
            {{ issue.message }}
          </li>
        </ul>
      </div>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" class="btn-primary" :disabled="!format || busy">
          {{ busy ? t('importDialog.importing') : t('importDialog.submit') }}
        </button>
      </div>
    </form>
  </dialog>
</template>
