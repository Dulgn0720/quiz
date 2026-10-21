<script setup lang="ts">
import { PIN_LENGTH, type QuizSummary } from '@quiz/shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { quizzesApi } from '@/api/quizzes';
import { quizTheme, shortTitle } from '@/brand/topics';
import HostGameDialog from '@/components/game/HostGameDialog.vue';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const pin = ref('');
const pinValid = computed(() => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin.value));
const quizzes = ref<QuizSummary[]>([]);
const loaded = ref(false);
const hosting = ref<QuizSummary | null>(null);

const totalQuestions = computed(() => quizzes.value.reduce((n, q) => n + q.questionCount, 0));

function onPinInput(event: Event): void {
  pin.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

function join(): void {
  if (pinValid.value) void router.push({ name: 'join-pin', params: { pin: pin.value } });
}

onMounted(async () => {
  try {
    const res = await quizzesApi.list({ page: 1, pageSize: 24 });
    // Company quizzes first.
    quizzes.value = [...res.items].sort((a, b) => Number(b.isSample) - Number(a.isSample));
  } catch {
    // The home page still works without the list.
  } finally {
    loaded.value = true;
  }
});
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pb-20">
    <!-- Hero -->
    <section class="grid items-center gap-10 pt-12 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
      <div class="animate-rise">
        <span class="chip bg-brand-500/15 px-3 py-1 text-sm text-brand-700 ring-1 ring-brand-500/25 dark:text-brand-300">
          <span class="h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
          {{ $t('app.tagline') }}
        </span>
        <h1 class="mt-6 text-4xl font-bold leading-[1.05] sm:text-6xl">
          {{ $t('home.titleLead') }}
          <span class="text-gradient">{{ $t('home.titleAccent') }}</span>
        </h1>
        <p class="mt-6 max-w-xl text-lg text-ink-600 dark:text-ink-300">{{ $t('home.subtitle') }}</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <RouterLink to="/quizzes" class="btn-primary px-7 py-3.5 text-base">▶ {{ $t('home.hostCta') }}</RouterLink>
          <RouterLink v-if="auth.canEditQuizzes" to="/quizzes/new" class="btn-secondary px-7 py-3.5 text-base">{{ $t('home.createCta') }}</RouterLink>
        </div>
        <dl v-if="quizzes.length" class="mt-10 flex gap-8 text-sm">
          <div>
            <dt class="text-ink-500 dark:text-ink-400">{{ $t('home.statQuizzes') }}</dt>
            <dd class="font-display text-3xl font-bold">{{ quizzes.length }}</dd>
          </div>
          <div>
            <dt class="text-ink-500 dark:text-ink-400">{{ $t('home.statQuestions') }}</dt>
            <dd class="font-display text-3xl font-bold">{{ totalQuestions }}</dd>
          </div>
        </dl>
      </div>

      <!-- Join card -->
      <form
        class="stage animate-rise overflow-hidden rounded-[2rem] p-8 shadow-2xl [animation-delay:120ms] sm:p-10"
        @submit.prevent="join"
      >
        <p class="font-display text-2xl font-bold">{{ $t('home.joinTitle') }}</p>
        <p class="mt-2 text-ink-300">{{ $t('home.joinSubtitle') }}</p>
        <label class="mt-8 block">
          <span class="sr-only">PIN</span>
          <input
            :value="pin"
            inputmode="numeric"
            autocomplete="off"
            :maxlength="PIN_LENGTH"
            placeholder="000000"
            class="w-full rounded-2xl border-0 bg-white/10 px-3 py-4 text-center font-display text-3xl font-bold tracking-[0.2em] text-white sm:px-5 sm:text-4xl sm:tracking-[0.35em] outline-none ring-1 ring-white/15 placeholder:text-white/25 focus:ring-2 focus:ring-brand-400"
            @input="onPinInput"
          />
        </label>
        <button type="submit" class="btn-primary mt-4 w-full py-4 text-base" :disabled="!pinValid">
          {{ $t('home.joinCta') }} →
        </button>
        <RouterLink to="/rooms" class="mt-5 block text-center text-sm font-semibold text-ink-300 hover:text-white">
          {{ $t('home.browseRooms') }}
        </RouterLink>
      </form>
    </section>

    <!-- Company quizzes -->
    <section class="mt-24">
      <div class="flex flex-wrap items-end gap-3">
        <div class="mr-auto">
          <h2 class="text-2xl font-bold sm:text-3xl">{{ $t('home.libraryTitle') }}</h2>
          <p class="mt-1 text-ink-600 dark:text-ink-300">{{ $t('home.librarySubtitle') }}</p>
        </div>
        <RouterLink to="/quizzes" class="btn-secondary">{{ $t('home.seeAll') }} →</RouterLink>
      </div>

      <ul v-if="!loaded" class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        <li v-for="i in 6" :key="i" class="card h-48 animate-pulse" />
      </ul>
      <ul v-else class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="(quiz, i) in quizzes"
          :key="quiz.id"
          class="card group flex animate-rise flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl"
          :style="{ animationDelay: `${Math.min(i, 8) * 50}ms` }"
        >
          <div class="relative h-28 bg-gradient-to-br p-5" :class="quizTheme(quiz.title).gradient">
            <span class="absolute -bottom-4 right-4 text-7xl drop-shadow-lg transition duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true">
              {{ quizTheme(quiz.title).icon }}
            </span>
            <span class="chip bg-black/25 text-white backdrop-blur">
              {{ $t('quizList.questions', { n: quiz.questionCount }, quiz.questionCount) }}
            </span>
          </div>
          <div class="flex flex-1 flex-col p-5">
            <h3 class="font-display text-base font-bold leading-snug">{{ shortTitle(quiz.title) }}</h3>
            <p v-if="quiz.description" class="mt-1.5 line-clamp-2 text-sm text-ink-600 dark:text-ink-300">{{ quiz.description }}</p>
            <div class="mt-auto flex items-center gap-2 pt-4">
              <button type="button" class="btn-primary px-4" :disabled="quiz.questionCount === 0" @click="hosting = quiz">
                ▶ {{ $t('quizList.host') }}
              </button>
              <RouterLink :to="{ name: 'quiz-edit', params: { id: quiz.id } }" class="btn-ghost px-3">
                {{ $t('home.preview') }}
              </RouterLink>
            </div>
          </div>
        </li>
      </ul>
      <p v-if="loaded && quizzes.length === 0" class="mt-8 text-ink-500">{{ $t('quizList.empty') }}</p>
    </section>

    <!-- How it works -->
    <section class="mt-24 grid gap-4 sm:grid-cols-3">
      <div v-for="(step, i) in ['host', 'join', 'play']" :key="step" class="card p-6">
        <span class="font-display text-4xl font-bold text-brand-500">0{{ i + 1 }}</span>
        <h3 class="mt-3 font-display text-lg font-bold">{{ $t(`home.steps.${step}.title`) }}</h3>
        <p class="mt-1 text-sm text-ink-600 dark:text-ink-300">{{ $t(`home.steps.${step}.text`) }}</p>
      </div>
    </section>

    <HostGameDialog :quiz="hosting" @close="hosting = null" />
  </div>
</template>
