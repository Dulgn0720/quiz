<script setup lang="ts">
import type { QuizCategory, QuizSummary } from '@quiz/shared';
import { quizTheme, shortTitle } from '@/brand/topics';

/** One topic as a horizontally scrolling shelf of quiz cards. */
defineProps<{ category: QuizCategory; quizzes: QuizSummary[] }>();
const emit = defineEmits<{ host: [quiz: QuizSummary] }>();
</script>

<template>
  <section class="mt-10">
    <div class="flex items-center gap-3">
      <h3 class="mr-auto font-display text-xl font-bold">
        <span aria-hidden="true">{{ $t(`categories.${category}.icon`) }}</span> {{ $t(`categories.${category}.name`) }}
        <span class="ml-1 text-base font-semibold text-ink-400">{{ quizzes.length }}</span>
      </h3>
      <RouterLink :to="{ name: 'quizzes', query: { category } }" class="text-sm font-bold text-brand-600 hover:underline dark:text-brand-300">
        {{ $t('home.shelfAll') }} →
      </RouterLink>
    </div>
    <ul class="shelf -mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4">
      <li v-for="quiz in quizzes" :key="quiz.id" class="w-64 shrink-0 snap-start sm:w-72">
        <article class="card group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div class="relative h-24 bg-gradient-to-br p-4" :class="quizTheme(quiz.title).gradient">
            <span class="absolute -bottom-3 right-3 text-6xl drop-shadow-lg transition duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true">
              {{ quizTheme(quiz.title).icon }}
            </span>
            <span class="chip bg-black/25 text-white backdrop-blur">{{ $t('quizList.questions', { n: quiz.questionCount }, quiz.questionCount) }}</span>
          </div>
          <div class="flex flex-1 flex-col p-4">
            <h4 class="font-display text-base font-bold leading-snug">{{ shortTitle(quiz.title) }}</h4>
            <p v-if="quiz.description" class="mt-1 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">{{ quiz.description }}</p>
            <div class="mt-auto flex items-center gap-2 pt-3">
              <button type="button" class="btn-primary px-4 py-2 text-sm" :disabled="quiz.questionCount === 0" @click="emit('host', quiz)">
                ▶ {{ $t('quizList.host') }}
              </button>
              <RouterLink
                v-if="quiz.questionCount > 0"
                :to="{ name: 'practice', params: { id: quiz.id } }"
                class="btn-secondary px-3 py-2 text-sm"
                :title="$t('practice.cardHint')"
              >
                🎯 {{ $t('practice.cta') }}
              </RouterLink>
            </div>
          </div>
        </article>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.shelf {
  scrollbar-width: thin;
  mask-image: linear-gradient(to right, transparent, black 1rem, black calc(100% - 2rem), transparent);
}
</style>
