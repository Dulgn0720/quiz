<script setup lang="ts">
import { LIMITS, QUESTION_TYPES, isChoiceQuestionType, type QuestionType } from '@quiz/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { changeQuestionType } from '@/editor/draft';
import { useFieldErrors } from '@/editor/useFieldErrors';
import { useEditorStore } from '@/stores/editor';
import ChoiceOptionsEditor from './ChoiceOptionsEditor.vue';
import ImageField from './ImageField.vue';
import OrderingItemsEditor from './OrderingItemsEditor.vue';

const props = defineProps<{ roundIndex: number; questionIndex: number }>();
const editor = useEditorStore();
const { fieldError } = useFieldErrors();
const { t } = useI18n();

const round = computed(() => editor.draft.rounds[props.roundIndex]!);
const question = computed(() => round.value.questions[props.questionIndex]!);
const path = computed(() => `rounds.${props.roundIndex}.questions.${props.questionIndex}`);
const err = (field: string) => fieldError(`${path.value}.${field}`);

const typeIcons: Record<QuestionType, string> = {
  single: '◉',
  multiple: '☑',
  true_false: '⚖',
  type_answer: '⌨',
  ordering: '⇅',
  image: '🖼',
};

function setType(type: QuestionType): void {
  changeQuestionType(question.value, type);
}

function removeAcceptedAnswer(index: number): void {
  question.value.acceptedAnswers.splice(index, 1);
}
</script>

<template>
  <section class="card space-y-6 p-5" :aria-label="t('editor.questionN', { n: questionIndex + 1 })">
    <div class="flex flex-wrap items-center gap-1">
      <h2 class="mr-auto text-lg font-black">{{ t('editor.questionN', { n: questionIndex + 1 }) }}</h2>
      <button
        type="button"
        class="btn-icon"
        :disabled="questionIndex === 0"
        :aria-label="t('common.moveUp')"
        :title="t('common.moveUp')"
        @click="editor.moveQuestion(roundIndex, questionIndex, -1)"
      >
        ↑
      </button>
      <button
        type="button"
        class="btn-icon"
        :disabled="questionIndex === round.questions.length - 1"
        :aria-label="t('common.moveDown')"
        :title="t('common.moveDown')"
        @click="editor.moveQuestion(roundIndex, questionIndex, 1)"
      >
        ↓
      </button>
      <button
        type="button"
        class="btn-ghost"
        :disabled="round.questions.length >= LIMITS.questionsPerRoundMax"
        @click="editor.duplicateQuestion(roundIndex, questionIndex)"
      >
        {{ t('editor.duplicateQuestion') }}
      </button>
      <button type="button" class="btn-danger" @click="editor.removeQuestion(roundIndex, questionIndex)">
        {{ t('editor.deleteQuestion') }}
      </button>
    </div>

    <fieldset>
      <legend class="label">{{ t('question.type') }}</legend>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label
          v-for="type in QUESTION_TYPES"
          :key="type"
          class="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-200"
          :class="question.type === type ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 hover:border-slate-300'"
        >
          <input
            type="radio"
            class="sr-only"
            :name="`question-type-${question.key}`"
            :value="type"
            :checked="question.type === type"
            @change="setType(type)"
          />
          <span class="text-lg" aria-hidden="true">{{ typeIcons[type] }}</span>
          {{ t(`question.types.${type}`) }}
        </label>
      </div>
    </fieldset>

    <label class="block">
      <span class="label">{{ t('question.prompt') }}</span>
      <textarea
        v-model="question.prompt"
        rows="2"
        class="input text-lg font-semibold"
        :class="{ 'input-error': err('prompt') }"
        :placeholder="t('question.promptPlaceholder')"
        :maxlength="LIMITS.promptMax"
      />
      <p v-if="err('prompt')" class="field-error">{{ err('prompt') }}</p>
    </label>

    <div>
      <ImageField v-model="question.imageUrl" :label="t('question.image')" :error="err('imageUrl')" />
      <p v-if="question.type === 'image'" class="mt-1 text-sm text-slate-500">{{ t('question.imageRequiredHint') }}</p>
    </div>

    <ChoiceOptionsEditor v-if="isChoiceQuestionType(question.type)" :question="question" :path="path" />

    <fieldset v-else-if="question.type === 'true_false'">
      <legend class="label">{{ t('question.options') }}</legend>
      <div class="grid grid-cols-2 gap-3">
        <label
          v-for="value in [true, false]"
          :key="String(value)"
          class="flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 text-lg font-black transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-200"
          :class="question.trueFalse === value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200'"
        >
          <input v-model="question.trueFalse" type="radio" class="sr-only" :name="`tf-${question.key}`" :value="value" />
          {{ value ? t('question.true') : t('question.false') }}
        </label>
      </div>
    </fieldset>

    <fieldset v-else-if="question.type === 'type_answer'">
      <legend class="label">{{ t('question.acceptedAnswers') }}</legend>
      <ul class="space-y-2">
        <li v-for="(_, i) in question.acceptedAnswers" :key="i" class="flex items-center gap-2">
          <input
            v-model="question.acceptedAnswers[i]"
            class="input min-w-0 flex-1"
            :class="{ 'input-error': err(`acceptedAnswers.${i}`) }"
            :placeholder="t('question.acceptedAnswerPlaceholder')"
            :maxlength="LIMITS.acceptedAnswerMax"
          />
          <button
            type="button"
            class="btn-icon"
            :disabled="question.acceptedAnswers.length <= 1"
            :aria-label="`${t('common.remove')} ${i + 1}`"
            @click="removeAcceptedAnswer(i)"
          >
            ✕
          </button>
        </li>
      </ul>
      <div class="mt-3 flex flex-wrap items-center gap-4">
        <button
          v-if="question.acceptedAnswers.length < LIMITS.acceptedAnswersMax"
          type="button"
          class="btn-ghost"
          @click="question.acceptedAnswers.push('')"
        >
          ＋ {{ t('question.addAcceptedAnswer') }}
        </button>
        <label class="flex min-h-11 cursor-pointer items-center gap-2">
          <input v-model="question.caseSensitive" type="checkbox" class="h-5 w-5 accent-brand-600" />
          <span class="font-semibold">{{ t('question.caseSensitive') }}</span>
        </label>
      </div>
      <p v-if="err('acceptedAnswers')" class="field-error">{{ err('acceptedAnswers') }}</p>
    </fieldset>

    <OrderingItemsEditor v-else-if="question.type === 'ordering'" :question="question" :path="path" />

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="label">{{ t('question.timeLimit') }} ({{ t('common.seconds') }})</span>
        <input
          v-model.number="question.timeLimit"
          type="number"
          inputmode="numeric"
          class="input"
          :class="{ 'input-error': err('timeLimit') }"
          :min="LIMITS.timeMin"
          :max="LIMITS.timeMax"
          :placeholder="t('question.timeLimitPlaceholder', { n: round.timePerQuestion })"
        />
        <p v-if="err('timeLimit')" class="field-error">{{ err('timeLimit') }}</p>
      </label>
      <label class="block">
        <span class="label">{{ t('question.basePoints') }}</span>
        <input
          v-model.number="question.basePoints"
          type="number"
          inputmode="numeric"
          step="100"
          class="input"
          :class="{ 'input-error': err('basePoints') }"
          min="0"
          :max="LIMITS.basePointsMax"
        />
        <p v-if="err('basePoints')" class="field-error">{{ err('basePoints') }}</p>
      </label>
    </div>

    <label class="block">
      <span class="label">{{ t('question.explanation') }} <span class="font-normal text-slate-400">({{ t('common.optional') }})</span></span>
      <textarea
        v-model="question.explanation"
        rows="2"
        class="input"
        :class="{ 'input-error': err('explanation') }"
        :placeholder="t('question.explanationPlaceholder')"
        :maxlength="LIMITS.explanationMax"
      />
      <p v-if="err('explanation')" class="field-error">{{ err('explanation') }}</p>
    </label>
  </section>
</template>
