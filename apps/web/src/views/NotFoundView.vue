<script setup lang="ts">
import Mascot from '@/components/Mascot.vue';
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
    <Mascot mood="dizzy" :size="160" />
    <p class="mt-2 font-display text-6xl font-bold text-brand-500">404</p>
    <h1 class="mt-3 text-2xl font-bold">{{ $t('notFound.title') }}</h1>
    <p class="mt-2 text-slate-600 dark:text-slate-300">{{ $t('mascot.lost') }}</p>
    <RouterLink to="/" class="btn-primary mt-8">{{ $t('notFound.home') }}</RouterLink>
  </section>
</template>
