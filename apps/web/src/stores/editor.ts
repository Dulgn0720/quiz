import type { Locale, QuestionType, QuizDetail } from '@quiz/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { ApiError } from '@/api/client';
import { quizzesApi } from '@/api/quizzes';
import {
  cloneQuestion,
  createQuestion,
  createQuiz,
  createRound,
  detailToDraft,
  draftToInput,
  moveItem,
  validateDraft,
  type DraftQuiz,
} from '@/editor/draft';

export type EditorSelection =
  | { kind: 'quiz' }
  | { kind: 'round'; roundIndex: number }
  | { kind: 'question'; roundIndex: number; questionIndex: number };

export type SaveResult = { ok: true; quiz: QuizDetail } | { ok: false; reason: 'invalid' | 'error'; error?: unknown };

export const useEditorStore = defineStore('editor', () => {
  const quizId = ref<string | null>(null);
  const isSample = ref(false);
  /** Owner of the loaded quiz, if it belongs to an account. */
  const ownerId = ref<string | undefined>(undefined);
  const draft = ref<DraftQuiz>(createQuiz('mn', ''));
  const selection = ref<EditorSelection>({ kind: 'question', roundIndex: 0, questionIndex: 0 });
  /** JSON of the draft as last loaded or saved; the draft is dirty when it differs. */
  const savedSnapshot = ref(JSON.stringify(draft.value));
  const saving = ref(false);
  /** Errors are only shown after the first save attempt, to avoid shouting at a blank form. */
  const showErrors = ref(false);

  const dirty = computed(() => JSON.stringify(draft.value) !== savedSnapshot.value);
  const errors = computed(() => validateDraft(draft.value));
  const isValid = computed(() => errors.value.size === 0);

  function replaceDraft(next: DraftQuiz): void {
    draft.value = next;
    savedSnapshot.value = JSON.stringify(next);
    showErrors.value = false;
  }

  function startNew(language: Locale, roundName: string): void {
    quizId.value = null;
    isSample.value = false;
    ownerId.value = undefined;
    replaceDraft(createQuiz(language, roundName));
    selection.value = { kind: 'quiz' };
  }

  async function load(id: string): Promise<void> {
    const detail = await quizzesApi.get(id);
    quizId.value = detail.id;
    isSample.value = detail.isSample;
    ownerId.value = detail.ownerId;
    replaceDraft(detailToDraft(detail));
    selection.value = { kind: 'question', roundIndex: 0, questionIndex: 0 };
  }

  async function save(): Promise<SaveResult> {
    showErrors.value = true;
    if (!isValid.value) return { ok: false, reason: 'invalid' };
    saving.value = true;
    try {
      const snapshot = JSON.stringify(draft.value);
      const input = draftToInput(draft.value);
      const saved = quizId.value
        ? await quizzesApi.update(quizId.value, input)
        : await quizzesApi.create(input);
      quizId.value = saved.id;
      // Keep the draft (and the user's selection) as is. Edits made while the
      // request was in flight still count as unsaved.
      savedSnapshot.value = snapshot;
      return { ok: true, quiz: saved };
    } catch (error) {
      return { ok: false, reason: error instanceof ApiError && error.status === 400 ? 'invalid' : 'error', error };
    } finally {
      saving.value = false;
    }
  }

  // --- Rounds -------------------------------------------------------------

  function addRound(name: string): void {
    draft.value.rounds.push(createRound(name));
    const roundIndex = draft.value.rounds.length - 1;
    selection.value = { kind: 'round', roundIndex };
  }

  function removeRound(roundIndex: number): void {
    if (draft.value.rounds.length <= 1) return;
    draft.value.rounds.splice(roundIndex, 1);
    selection.value = { kind: 'round', roundIndex: Math.max(0, roundIndex - 1) };
  }

  function moveRound(roundIndex: number, delta: -1 | 1): void {
    moveItem(draft.value.rounds, roundIndex, roundIndex + delta);
    if (selection.value.kind !== 'quiz' && selection.value.roundIndex === roundIndex) {
      const target = roundIndex + delta;
      if (target >= 0 && target < draft.value.rounds.length) {
        selection.value = { ...selection.value, roundIndex: target };
      }
    }
  }

  // --- Questions ----------------------------------------------------------

  function addQuestion(roundIndex: number, type: QuestionType = 'single'): void {
    const round = draft.value.rounds[roundIndex];
    if (!round) return;
    round.questions.push(createQuestion(type));
    selection.value = { kind: 'question', roundIndex, questionIndex: round.questions.length - 1 };
  }

  function duplicateQuestion(roundIndex: number, questionIndex: number): void {
    const round = draft.value.rounds[roundIndex];
    const question = round?.questions[questionIndex];
    if (!round || !question) return;
    round.questions.splice(questionIndex + 1, 0, cloneQuestion(question));
    selection.value = { kind: 'question', roundIndex, questionIndex: questionIndex + 1 };
  }

  function removeQuestion(roundIndex: number, questionIndex: number): void {
    const round = draft.value.rounds[roundIndex];
    if (!round) return;
    round.questions.splice(questionIndex, 1);
    selection.value =
      round.questions.length > 0
        ? { kind: 'question', roundIndex, questionIndex: Math.min(questionIndex, round.questions.length - 1) }
        : { kind: 'round', roundIndex };
  }

  function moveQuestion(roundIndex: number, questionIndex: number, delta: -1 | 1): void {
    const round = draft.value.rounds[roundIndex];
    if (!round) return;
    const target = questionIndex + delta;
    if (target < 0 || target >= round.questions.length) return;
    moveItem(round.questions, questionIndex, target);
    selection.value = { kind: 'question', roundIndex, questionIndex: target };
  }

  return {
    quizId,
    isSample,
    ownerId,
    draft,
    selection,
    dirty,
    saving,
    showErrors,
    errors,
    isValid,
    startNew,
    load,
    save,
    addRound,
    removeRound,
    moveRound,
    addQuestion,
    duplicateQuestion,
    removeQuestion,
    moveQuestion,
  };
});
