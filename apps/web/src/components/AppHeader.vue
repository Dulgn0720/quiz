<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import BrandMark from './BrandMark.vue';
import LocaleSwitch from './LocaleSwitch.vue';
import ThemeToggle from './ThemeToggle.vue';

const auth = useAuthStore();
const navActive = 'bg-ink-900/5 text-ink-950 dark:bg-white/10 dark:text-white';
</script>

<template>
  <header class="sticky top-0 z-30 px-3 pt-3">
    <div
      class="mx-auto flex h-16 max-w-6xl items-center gap-0.5 rounded-full sm:gap-1 bg-white/70 pl-3 pr-2 shadow-soft ring-1 ring-ink-900/5 backdrop-blur-xl dark:bg-ink-900/60 dark:ring-white/10"
    >
      <RouterLink to="/" class="mr-auto flex items-center gap-2.5 rounded-full pr-2" :aria-label="$t('nav.home')">
        <BrandMark :size="38" />
        <span class="hidden font-display text-lg font-bold leading-none sm:block">
          Agula<span class="text-brand-500"> Quiz</span>
        </span>
      </RouterLink>
      <nav class="flex items-center gap-0.5" :aria-label="$t('nav.home')">
        <RouterLink to="/join" class="btn-ghost px-3" :active-class="navActive">
          <span class="sm:hidden">{{ $t('home.joinCta') }}</span>
          <span class="hidden sm:inline">{{ $t('nav.join') }}</span>
        </RouterLink>
        <RouterLink to="/rooms" class="btn-ghost hidden px-3 md:inline-flex" :active-class="navActive">{{ $t('nav.rooms') }}</RouterLink>
        <RouterLink to="/quizzes" class="btn-ghost hidden px-3 sm:inline-flex" :active-class="navActive">{{ $t('nav.quizzes') }}</RouterLink>
        <RouterLink to="/leaderboard" class="btn-ghost hidden px-3 lg:inline-flex" :active-class="navActive">{{ $t('nav.leaderboard') }}</RouterLink>
        <RouterLink v-if="auth.canEditQuizzes" to="/quizzes/new" class="btn-primary ml-1 hidden px-4 sm:inline-flex">
          <span aria-hidden="true">＋</span>
          <span class="hidden lg:inline">{{ $t('nav.create') }}</span>
          <span class="sr-only lg:hidden">{{ $t('nav.create') }}</span>
        </RouterLink>
      </nav>
      <RouterLink
        v-if="auth.user"
        to="/me"
        class="btn-ghost ml-1 gap-1.5 px-2"
        :aria-label="$t('nav.profile', { name: auth.user.displayName })"
        :title="auth.user.displayName"
      >
        <span class="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-lg dark:bg-brand-500/20" aria-hidden="true">
          {{ auth.user.avatar ?? '🙂' }}
        </span>
        <span class="chip hidden bg-ink-900 text-white dark:bg-white dark:text-ink-950 lg:inline-flex">
          {{ $t('profile.levelShort', { n: auth.user.level }) }}
        </span>
      </RouterLink>
      <RouterLink v-else-if="!auth.restoring" to="/login" class="btn-ghost px-3">{{ $t('nav.signIn') }}</RouterLink>
      <ThemeToggle />
      <LocaleSwitch />
    </div>
  </header>
</template>
