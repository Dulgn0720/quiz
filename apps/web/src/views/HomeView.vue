<script setup lang="ts">
import { PIN_LENGTH, QUIZ_CATEGORIES, type QuizSummary } from '@quiz/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { quizzesApi } from '@/api/quizzes';
import { trainingsApi } from '@/api/trainings';
import HostGameDialog from '@/components/game/HostGameDialog.vue';
import DailyCard from '@/components/DailyCard.vue';
import GameModes from '@/components/home/GameModes.vue';
import QuizShelf from '@/components/home/QuizShelf.vue';
import Mascot from '@/components/Mascot.vue';
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

/** One shelf per topic, in the library's topic order. */
const shelves = computed(() =>
  QUIZ_CATEGORIES.map((c) => ({ category: c, quizzes: quizzes.value.filter((q) => q.category === c) })).filter((s) => s.quizzes.length),
);
const categoryCounts = computed(() =>
  QUIZ_CATEGORIES.map((c) => ({ code: c, count: quizzes.value.filter((q) => q.category === c).length })).filter((c) => c.count > 0),
);

function onPinInput(event: Event): void {
  pin.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

function join(): void {
  if (pinValid.value) void router.push({ name: 'join-pin', params: { pin: pin.value } });
}

/** Required trainings still to do, nudged on the home page. */
const pendingTrainings = ref(0);
watch(
  () => auth.user?.id,
  async (id) => {
    pendingTrainings.value = 0;
    if (!id) return;
    try {
      pendingTrainings.value = (await trainingsApi.list()).filter((x) => x.active && x.status !== 'passed').length;
    } catch {
      // Not essential.
    }
  },
  { immediate: true },
);

onMounted(async () => {
  try {
    // The API pages by 50; the official library fits in a few pages.
    const all: QuizSummary[] = [];
    for (let page = 1; page <= 4; page++) {
      const res = await quizzesApi.list({ scope: 'official', page, pageSize: 50 });
      all.push(...res.items);
      if (all.length >= res.total || res.items.length === 0) break;
    }
    quizzes.value = all;
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
    <section class="grid items-center gap-8 pt-8 sm:gap-10 sm:pt-20 lg:grid-cols-[1.15fr_1fr]">
      <div class="animate-rise">
        <span class="chip bg-brand-500/15 px-3 py-1 text-sm text-brand-700 ring-1 ring-brand-500/25 dark:text-brand-300">
          <span class="h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
          {{ $t('app.tagline') }}
        </span>
        <h1 class="mt-6 text-3xl font-bold leading-[1.05] sm:text-6xl">
          {{ $t('home.titleLead') }}
          <span class="text-gradient">{{ $t('home.titleAccent') }}</span>
        </h1>
        <p class="mt-6 max-w-xl text-lg text-ink-600 dark:text-ink-300">{{ $t('home.subtitle') }}</p>
        <div class="mt-8 hidden flex-wrap gap-3 sm:flex">
          <RouterLink to="/quizzes" class="btn-primary px-7 py-3.5 text-base">▶ {{ $t('home.hostCta') }}</RouterLink>
          <RouterLink v-if="auth.canEditQuizzes" to="/quizzes/new" class="btn-secondary px-7 py-3.5 text-base">{{ $t('home.createCta') }}</RouterLink>
        </div>
        <dl v-if="quizzes.length" class="mt-10 hidden gap-8 text-sm sm:flex">
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
        class="dark stage order-first animate-rise overflow-hidden rounded-[2rem] p-6 shadow-2xl [animation-delay:120ms] sm:p-10 lg:order-none"
        @submit.prevent="join"
      >
        <Mascot mood="wave" :size="96" class="pointer-events-none absolute -right-2 -top-1 hidden sm:block" />
        <p class="font-display text-2xl font-bold sm:pr-20">{{ $t('home.joinTitle') }}</p>
        <p class="mt-2 text-ink-300 sm:pr-20">{{ $t('home.joinSubtitle') }}</p>
        <label class="mt-8 block">
          <span class="sr-only">PIN</span>
          <input
            :value="pin"
            inputmode="numeric"
            autocomplete="off"
            :maxlength="PIN_LENGTH"
            pattern="[0-9]*"
            enterkeyhint="go"
            placeholder="••••••"
            class="w-full rounded-2xl border-0 bg-white/10 px-3 py-4 text-center font-display text-3xl font-bold tracking-[0.2em] text-white sm:px-5 sm:text-4xl sm:tracking-[0.35em] outline-none ring-1 ring-white/15 placeholder:text-white/20 focus:ring-2 focus:ring-brand-400"
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

    <!-- How it works -->
    <section class="mt-12 grid gap-3 sm:grid-cols-3" :aria-label="$t('home.howItWorks')">
      <div v-for="(step, i) in ['host', 'join', 'play']" :key="step" class="card flex items-start gap-4 p-5">
        <span class="font-display text-2xl font-bold text-brand-500" aria-hidden="true">0{{ i + 1 }}</span>
        <div>
          <h2 class="font-display text-base font-bold">{{ $t(`home.steps.${step}.title`) }}</h2>
          <p class="mt-1 text-sm text-ink-600 dark:text-ink-300">{{ $t(`home.steps.${step}.text`) }}</p>
        </div>
      </div>
    </section>

    <!-- Required trainings -->
    <RouterLink
      v-if="pendingTrainings > 0"
      to="/trainings"
      class="training-nudge card mt-10 flex items-center gap-4 border-2 border-amber-300 p-5 transition hover:-translate-y-0.5 dark:border-amber-400/40"
    >
      <span class="text-4xl" aria-hidden="true">🎓</span>
      <span class="flex-1 font-display text-lg font-bold">{{ $t('trainings.homeBanner', { n: pendingTrainings }) }}</span>
      <span class="btn-primary">{{ $t('trainings.homeOpen') }} →</span>
    </RouterLink>

    <!-- Ways to play -->
    <GameModes />

    <!-- Daily question -->
    <DailyCard id="daily" class="mt-12 scroll-mt-24" />

    <!-- Company quizzes -->
    <section class="mt-16 sm:mt-20">
      <div class="flex flex-wrap items-end gap-3">
        <div class="mr-auto">
          <h2 class="text-2xl font-bold sm:text-3xl">{{ $t('home.libraryTitle') }}</h2>
          <p class="mt-1 text-ink-600 dark:text-ink-300">{{ $t('home.librarySubtitle') }}</p>
        </div>
        <RouterLink to="/quizzes" class="btn-secondary">{{ $t('home.seeAll', { n: quizzes.length }) }} →</RouterLink>
      </div>

      <nav v-if="categoryCounts.length" class="mt-6 flex gap-2 overflow-x-auto pb-1" :aria-label="$t('quizList.categoryLabel')">
        <RouterLink
          v-for="c in categoryCounts"
          :key="c.code"
          :to="{ name: 'quizzes', query: { category: c.code } }"
          class="chip shrink-0 px-4 py-2 text-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-white dark:ring-white/15 dark:hover:bg-white/5"
        >
          {{ $t(`categories.${c.code}.icon`) }} {{ $t(`categories.${c.code}.name`) }}
          <span class="text-slate-400">{{ c.count }}</span>
        </RouterLink>
      </nav>

      <div v-if="!loaded" class="mt-8 flex gap-4 overflow-hidden" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="card h-56 w-72 shrink-0 animate-pulse" />
      </div>
      <QuizShelf v-for="shelf in shelves" v-else :key="shelf.category" :category="shelf.category" :quizzes="shelf.quizzes" @host="hosting = $event" />
      <p v-if="loaded && quizzes.length === 0" class="mt-8 text-ink-500">{{ $t('quizList.empty') }}</p>
    </section>



    <!-- Leaderboard teaser -->
    <RouterLink
      to="/leaderboard"
      class="card group mt-12 flex items-center gap-4 overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6"
    >
      <span class="text-5xl transition group-hover:scale-110" aria-hidden="true">🏆</span>
      <span class="min-w-0 flex-1">
        <span class="block font-display text-xl font-bold">{{ $t('home.leaderboardTitle') }}</span>
        <span class="block text-ink-600 dark:text-ink-300">{{ $t('home.leaderboardText') }}</span>
      </span>
      <span class="hidden text-3xl sm:block" aria-hidden="true">🐦 🦅 🐘 🌟 🦁 👑</span>
    </RouterLink>

    <HostGameDialog :quiz="hosting" @close="hosting = null" />
  </div>
</template>
