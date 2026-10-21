<script setup lang="ts">
import { SUPPORTED_LOCALES, type Locale } from '@quiz/shared';
import { useI18n } from 'vue-i18n';
import { setLocale } from '@/i18n';

const { locale } = useI18n();
const labels: Record<Locale, string> = { mn: 'MN', en: 'EN' };
</script>

<template>
  <div class="flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5" role="group" :aria-label="$t('nav.language')">
    <button
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      type="button"
      class="min-h-9 rounded-lg px-2.5 text-xs font-black transition"
      :class="locale === code ? 'bg-brand-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
      :aria-pressed="locale === code"
      @click="setLocale(code)"
    >
      {{ labels[code] }}
    </button>
  </div>
</template>
