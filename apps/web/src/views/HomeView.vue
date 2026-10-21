<template>
  <section class="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:py-24">
    <span class="rounded-full bg-brand-100 dark:bg-brand-900/40 px-3 py-1 text-sm font-bold text-brand-700 dark:text-brand-300">{{ $t('app.tagline') }}</span>
    <h1 class="mt-6 text-4xl font-black tracking-tight sm:text-6xl">{{ $t('home.title') }}</h1>
    <p class="mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-300">{{ $t('home.subtitle') }}</p>
    <div class="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <RouterLink to="/join" class="btn-primary px-8 py-4 text-base">{{ $t('home.joinCta') }}</RouterLink>
      <RouterLink to="/quizzes/new" class="btn-secondary px-8 py-4 text-base">{{ $t('home.createCta') }}</RouterLink>
      <RouterLink to="/quizzes" class="btn-secondary px-8 py-4 text-base">{{ $t('home.browseCta') }}</RouterLink>
    </div>
  </section>
</template>
