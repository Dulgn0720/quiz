<script setup lang="ts">
import { SUPPORTED_LOCALES, type Locale } from '@quiz/shared';
import { useI18n } from 'vue-i18n';
import { setLocale } from '@/i18n';

const { locale } = useI18n();
const labels: Record<Locale, string> = { mn: 'MN', en: 'EN' };
</script>

<template>
  <div class="flex rounded-full bg-ink-900/5 p-0.5 dark:bg-white/10" role="group" :aria-label="$t('nav.language')">
    <button
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      type="button"
      class="min-h-9 rounded-full px-2.5 text-xs font-extrabold transition"
      :class="locale === code ? 'bg-white text-ink-950 shadow-sm dark:bg-ink-950 dark:text-white' : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white'"
      :aria-pressed="locale === code"
      @click="setLocale(code)"
    >
      {{ labels[code] }}
    </button>
  </div>
</template>
