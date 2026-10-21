<template>
  <section class="mx-auto max-w-md px-4 py-24 text-center">
    <p class="text-6xl font-black text-brand-600">404</p>
    <h1 class="mt-4 text-2xl font-black">{{ $t('notFound.title') }}</h1>
    <RouterLink to="/" class="btn-primary mt-8">{{ $t('notFound.home') }}</RouterLink>
  </section>
</template>
