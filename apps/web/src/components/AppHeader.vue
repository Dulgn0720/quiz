<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import LocaleSwitch from './LocaleSwitch.vue';
import ThemeToggle from './ThemeToggle.vue';

const auth = useAuthStore();
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
      <RouterLink to="/" class="mr-auto flex items-center gap-2 text-xl font-black text-brand-700 dark:text-brand-300">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white" aria-hidden="true">Q</span>
        {{ $t('app.name') }}
      </RouterLink>
      <nav class="flex items-center gap-1" :aria-label="$t('nav.home')">
        <RouterLink to="/join" class="btn-ghost" active-class="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
          {{ $t('nav.join') }}
        </RouterLink>
        <RouterLink to="/rooms" class="btn-ghost hidden md:inline-flex" active-class="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
          {{ $t('nav.rooms') }}
        </RouterLink>
        <RouterLink to="/quizzes" class="btn-ghost hidden sm:inline-flex" active-class="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
          {{ $t('nav.quizzes') }}
        </RouterLink>
        <RouterLink to="/quizzes/new" class="btn-primary">
          <span aria-hidden="true">＋</span>
          <span class="hidden sm:inline">{{ $t('nav.create') }}</span>
          <span class="sr-only sm:hidden">{{ $t('nav.create') }}</span>
        </RouterLink>
      </nav>
      <RouterLink
        v-if="auth.user"
        to="/me"
        class="btn-ghost px-2"
        :aria-label="$t('nav.profile', { name: auth.user.displayName })"
        :title="auth.user.displayName"
      >
        <span class="text-xl" aria-hidden="true">{{ auth.user.avatar ?? '🙂' }}</span>
        <span class="hidden rounded-full bg-brand-100 dark:bg-brand-900/40 px-2 text-xs font-black text-brand-800 dark:text-brand-200 lg:inline">
          {{ $t('profile.levelShort', { n: auth.user.level }) }}
        </span>
      </RouterLink>
      <RouterLink v-else-if="!auth.restoring" to="/login" class="btn-ghost">{{ $t('nav.signIn') }}</RouterLink>
      <ThemeToggle />
      <LocaleSwitch />
    </div>
  </header>
</template>
