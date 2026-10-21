<script setup lang="ts">
/** Agula diamond mark. Replace with the official logo file when available. */
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="agula-mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fdba74" />
        <stop offset="0.5" stop-color="#f57c14" />
        <stop offset="1" stop-color="#e2630a" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="18" class="fill-ink-950 dark:fill-white/10" />
    <path d="M32 9 52 29 32 49 12 29Z" fill="url(#agula-mark)" />
    <path d="M20 37 32 25l12 12-4.5 4.5L32 34l-7.5 7.5Z" class="fill-ink-950" />
  </svg>
</template>
