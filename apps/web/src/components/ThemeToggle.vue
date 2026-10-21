<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '@/composables/useTheme';

const { t } = useI18n();
const { theme, cycle } = useTheme();
const icons = { system: '🖥️', light: '☀️', dark: '🌙' } as const;
const label = computed(() => t('settings.theme', { mode: t(`settings.themes.${theme.value}`) }));
</script>

<template>
  <button type="button" class="btn-icon text-lg" :aria-label="label" :title="label" @click="cycle">
    <span aria-hidden="true">{{ icons[theme] }}</span>
  </button>
</template>
