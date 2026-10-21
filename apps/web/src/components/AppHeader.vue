<script setup lang="ts">
import LocaleSwitch from './LocaleSwitch.vue';
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
      <RouterLink to="/" class="mr-auto flex items-center gap-2 text-xl font-black text-brand-700">
        <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white" aria-hidden="true">Q</span>
        {{ $t('app.name') }}
      </RouterLink>
      <nav class="flex items-center gap-1" :aria-label="$t('nav.home')">
        <RouterLink to="/join" class="btn-ghost" active-class="bg-slate-100 text-slate-900">
          {{ $t('nav.join') }}
        </RouterLink>
        <RouterLink to="/quizzes" class="btn-ghost hidden sm:inline-flex" active-class="bg-slate-100 text-slate-900">
          {{ $t('nav.quizzes') }}
        </RouterLink>
        <RouterLink to="/quizzes/new" class="btn-primary">
          <span aria-hidden="true">＋</span>
          <span class="hidden sm:inline">{{ $t('nav.create') }}</span>
          <span class="sr-only sm:hidden">{{ $t('nav.create') }}</span>
        </RouterLink>
      </nav>
      <LocaleSwitch />
    </div>
  </header>
</template>
