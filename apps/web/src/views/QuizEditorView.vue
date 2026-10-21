<script setup lang="ts">
import { LIMITS } from '@quiz/shared';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRouter, type RouteLocationNormalized } from 'vue-router';
import { ApiError } from '@/api/client';
import { quizzesApi } from '@/api/quizzes';
import QuestionEditor from '@/components/editor/QuestionEditor.vue';
import QuizSettingsPanel from '@/components/editor/QuizSettingsPanel.vue';
import RoundSettingsPanel from '@/components/editor/RoundSettingsPanel.vue';
import { useToast } from '@/composables/useToast';
import { hasErrorsUnder, roundSettingsHaveErrors, type DraftQuestion } from '@/editor/draft';
import { useFieldErrors } from '@/editor/useFieldErrors';
import { shortTitle } from '@/brand/topics';
import { useAuthStore } from '@/stores/auth';
import { useEditorStore, type EditorSelection } from '@/stores/editor';

const props = defineProps<{ id?: string }>();
const editor = useEditorStore();
const router = useRouter();
const toast = useToast();
const { t, locale } = useI18n();
const { fieldError } = useFieldErrors();

const loading = ref(false);
const loadError = ref<'not-found' | 'error' | null>(null);
const auth = useAuthStore();
/** Samples and other accounts' quizzes are read-only; duplicating makes an editable copy. */
const ownedByOther = computed(
  () => !!editor.ownerId && editor.ownerId !== auth.user?.id && auth.user?.isAdmin !== true,
);
const readOnly = computed(() => !auth.canEditQuizzes || editor.isSample || ownedByOther.value);
/** Set after creating a quiz, so swapping the URL to /quizzes/:id/edit does not reload it. */
let justCreatedId: string | null = null;

async function init(): Promise<void> {
  loadError.value = null;
  if (!props.id) {
    editor.startNew(locale.value === 'en' ? 'en' : 'mn', t('editor.roundDefaultName', { n: 1 }));
    return;
  }
  if (justCreatedId === props.id) {
    justCreatedId = null;
    return;
  }
  loading.value = true;
  try {
    await editor.load(props.id);
  } catch (error) {
    loadError.value = error instanceof ApiError && error.status === 404 ? 'not-found' : 'error';
  } finally {
    loading.value = false;
  }
}

watch(() => props.id, init);
onMounted(init);

function select(selection: EditorSelection): void {
  editor.selection = selection;
}

function isSelected(selection: EditorSelection): boolean {
  const current = editor.selection;
  if (current.kind !== selection.kind) return false;
  if (current.kind === 'quiz' || selection.kind === 'quiz') return true;
  if (current.roundIndex !== selection.roundIndex) return false;
  return current.kind !== 'question' || selection.kind !== 'question' || current.questionIndex === selection.questionIndex;
}

/** Jumps to the first part of the quiz that has a validation problem. */
function selectFirstError(): void {
  const [first] = editor.errors.keys();
  const match = first?.match(/^rounds\.(\d+)(?:\.questions\.(\d+))?/);
  if (!match) return select({ kind: 'quiz' });
  const roundIndex = Number(match[1]);
  if (match[2] !== undefined) select({ kind: 'question', roundIndex, questionIndex: Number(match[2]) });
  else select({ kind: 'round', roundIndex });
}

async function save(): Promise<void> {
  if (readOnly.value || editor.saving) return;
  const wasNew = !editor.quizId;
  const result = await editor.save();
  if (result.ok) {
    toast.success(t('common.saved'));
    if (wasNew) {
      justCreatedId = result.quiz.id;
      await router.replace({ name: 'quiz-edit', params: { id: result.quiz.id } });
    }
    return;
  }
  if (result.reason === 'invalid') {
    toast.error(t('editor.fixErrors'));
    selectFirstError();
  } else {
    toast.error(
      result.error instanceof ApiError && result.error.isNetworkError ? t('common.networkError') : t('editor.saveFailed'),
    );
  }
}

async function duplicateToEdit(): Promise<void> {
  if (!editor.quizId) return;
  try {
    const copy = await quizzesApi.duplicate(editor.quizId);
    await router.push({ name: 'quiz-edit', params: { id: copy.id } });
  } catch {
    toast.error(t('common.error'));
  }
}

function questionLabel(question: DraftQuestion): string {
  return question.prompt.trim() || t('editor.untitledQuestion');
}

function addRound(): void {
  editor.addRound(t('editor.roundDefaultName', { n: editor.draft.rounds.length + 1 }));
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void save();
  }
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (editor.dirty && !readOnly.value) event.preventDefault();
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('beforeunload', onBeforeUnload);
});

function confirmLeave(to: RouteLocationNormalized): boolean {
  // Replacing /quizzes/new with the saved quiz's URL is not leaving.
  if (to.name === 'quiz-edit' && to.params.id === editor.quizId) return true;
  if (editor.dirty && !readOnly.value) return window.confirm(t('common.leaveConfirm'));
  return true;
}
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate(confirmLeave);

const statusText = computed(() => {
  if (editor.saving) return t('common.saving');
  if (editor.dirty) return t('common.unsavedChanges');
  return editor.quizId ? t('common.saved') : '';
});
</script>

<template>
  <div v-if="loading" class="py-24 text-center text-slate-500 dark:text-slate-400">{{ t('common.loading') }}</div>

  <div v-else-if="loadError" class="mx-auto max-w-md px-4 py-24 text-center" role="alert">
    <p class="text-lg font-bold">{{ loadError === 'not-found' ? t('editor.notFound') : t('common.error') }}</p>
    <div class="mt-6 flex justify-center gap-2">
      <RouterLink to="/quizzes" class="btn-secondary">{{ t('common.back') }}</RouterLink>
      <button v-if="loadError === 'error'" type="button" class="btn-primary" @click="init">{{ t('common.retry') }}</button>
    </div>
  </div>

  <div v-else class="mx-auto max-w-6xl px-4 pb-24 pt-6">
    <!-- Title bar -->
    <div class="flex flex-wrap items-center gap-3">
      <RouterLink to="/quizzes" class="btn-icon" :aria-label="t('common.back')" :title="t('common.back')">←</RouterLink>
      <h1 v-if="readOnly" class="min-w-[min(100%,16rem)] flex-1 px-2 text-2xl font-bold sm:text-3xl">{{ shortTitle(editor.draft.title) }}</h1>
      <label v-else class="relative min-w-[min(100%,16rem)] flex-1">
        <span class="sr-only">{{ t('editor.titlePlaceholder') }}</span>
        <input
          v-model="editor.draft.title"
          class="w-full rounded-xl border-2 border-dashed border-slate-200 bg-transparent py-1 pl-3 pr-10 font-display text-2xl font-bold outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-solid focus:border-brand-500 dark:border-white/15 sm:text-3xl"
          :class="{ 'border-red-400': fieldError('title') }"
          :placeholder="t('editor.titlePlaceholder')"
          :maxlength="LIMITS.titleMax"
          :autofocus="!editor.quizId"
        />
        <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xl text-slate-400" aria-hidden="true">✎</span>
        <span v-if="fieldError('title')" class="field-error block px-2">{{ fieldError('title') }}</span>
      </label>
      <div class="flex items-center gap-2">
        <span v-if="!readOnly" class="text-sm font-semibold text-slate-500 dark:text-slate-400" aria-live="polite">{{ statusText }}</span>
        <template v-if="editor.quizId">
          <a :href="quizzesApi.exportUrl(editor.quizId, 'json')" class="btn-ghost" :title="t('quizList.exportJson')">JSON</a>
          <a :href="quizzesApi.exportUrl(editor.quizId, 'csv')" class="btn-ghost" :title="t('quizList.exportCsv')">CSV</a>
        </template>
        <button v-if="!readOnly" type="button" class="btn-primary" :disabled="editor.saving" @click="save">
          {{ editor.saving ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </div>

    <div
      v-if="readOnly"
      class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-200"
      role="status"
    >
      <p class="mr-auto font-semibold">
        {{ !auth.canEditQuizzes ? t('editor.readOnlyAdmins') : editor.isSample ? t('editor.readOnly') : t('editor.readOnlyOwned') }}
      </p>
      <button v-if="auth.canEditQuizzes" type="button" class="btn-primary" @click="duplicateToEdit">{{ t('editor.duplicateToEdit') }}</button>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
      <!-- Outline -->
      <nav class="min-w-0 space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-auto" :aria-label="t('editor.quizSettings')">
        <button
          type="button"
          class="w-full rounded-xl px-3 py-2.5 text-left font-bold transition"
          :class="isSelected({ kind: 'quiz' }) ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'"
          @click="select({ kind: 'quiz' })"
        >
          ⚙ {{ t('editor.quizSettings') }}
        </button>

        <div v-for="(round, ri) in editor.draft.rounds" :key="round.key" class="card p-2">
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="min-w-0 flex-1 rounded-lg px-2 py-2 text-left transition"
              :class="isSelected({ kind: 'round', roundIndex: ri }) ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'"
              @click="select({ kind: 'round', roundIndex: ri })"
            >
              <span class="block truncate font-black">
                <span
                  v-if="editor.showErrors && roundSettingsHaveErrors(editor.errors, ri)"
                  class="mr-1 inline-block h-2 w-2 rounded-full bg-red-500 align-middle"
                  :title="t('editor.hasErrors')"
                />
                {{ round.name || t('editor.roundDefaultName', { n: ri + 1 }) }}
              </span>
              <span class="block text-xs opacity-75">{{ t(`round.types.${round.type}`) }}</span>
            </button>
            <template v-if="!readOnly">
              <button type="button" class="btn-icon" :disabled="ri === 0" :aria-label="t('common.moveUp')" @click="editor.moveRound(ri, -1)">↑</button>
              <button
                type="button"
                class="btn-icon"
                :disabled="ri === editor.draft.rounds.length - 1"
                :aria-label="t('common.moveDown')"
                @click="editor.moveRound(ri, 1)"
              >
                ↓
              </button>
            </template>
          </div>
          <ol class="mt-1 space-y-0.5">
            <li v-for="(question, qi) in round.questions" :key="question.key">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition"
                :class="
                  isSelected({ kind: 'question', roundIndex: ri, questionIndex: qi })
                    ? 'bg-brand-100 dark:bg-brand-900/40 font-bold text-brand-900 dark:text-brand-100'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                "
                @click="select({ kind: 'question', roundIndex: ri, questionIndex: qi })"
              >
                <span class="w-5 shrink-0 text-right text-xs font-black text-slate-400">{{ qi + 1 }}</span>
                <span class="min-w-0 flex-1 truncate">{{ questionLabel(question) }}</span>
                <span
                  v-if="editor.showErrors && hasErrorsUnder(editor.errors, `rounds.${ri}.questions.${qi}`)"
                  class="h-2 w-2 shrink-0 rounded-full bg-red-500"
                  :title="t('editor.hasErrors')"
                />
              </button>
            </li>
          </ol>
          <button
            v-if="!readOnly && round.questions.length < LIMITS.questionsPerRoundMax"
            type="button"
            class="btn-ghost mt-1 w-full justify-start text-brand-700 dark:text-brand-300"
            @click="editor.addQuestion(ri)"
          >
            ＋ {{ t('editor.addQuestion') }}
          </button>
          <p v-if="fieldError(`rounds.${ri}.questions`)" class="field-error px-2">{{ fieldError(`rounds.${ri}.questions`) }}</p>
        </div>

        <button
          v-if="!readOnly && editor.draft.rounds.length < LIMITS.roundsMax"
          type="button"
          class="btn-secondary w-full"
          @click="addRound"
        >
          ＋ {{ t('editor.addRound') }}
        </button>
      </nav>

      <!-- Selected item -->
      <fieldset :disabled="readOnly" class="min-w-0">
        <QuizSettingsPanel v-if="editor.selection.kind === 'quiz'" />
        <RoundSettingsPanel
          v-else-if="editor.selection.kind === 'round' && editor.draft.rounds[editor.selection.roundIndex]"
          :key="`round-${editor.selection.roundIndex}`"
          :read-only="readOnly"
          :round-index="editor.selection.roundIndex"
        />
        <QuestionEditor
          v-else-if="
            editor.selection.kind === 'question' &&
            editor.draft.rounds[editor.selection.roundIndex]?.questions[editor.selection.questionIndex]
          "
          :key="`q-${editor.selection.roundIndex}-${editor.selection.questionIndex}`"
          :round-index="editor.selection.roundIndex"
          :question-index="editor.selection.questionIndex"
        />
      </fieldset>
    </div>
  </div>
</template>
