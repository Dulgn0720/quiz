<script setup lang="ts">
import { audioSettings } from '@/game/sound';

defineProps<{ music?: boolean }>();
</script>

<template>
  <div class="flex items-center">
    <button
      type="button"
      class="btn-icon"
      :aria-pressed="audioSettings.sfx"
      :aria-label="$t('settings.sound')"
      :title="$t('settings.sound')"
      @click="audioSettings.sfx = !audioSettings.sfx"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
        <template v-if="audioSettings.sfx"><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></template>
        <template v-else><path d="m16 9 6 6" /><path d="m22 9-6 6" /></template>
      </svg>
    </button>
    <button
      v-if="music"
      type="button"
      class="btn-icon"
      :class="audioSettings.music ? '' : 'opacity-40'"
      :aria-pressed="audioSettings.music"
      :aria-label="$t('settings.music')"
      :title="$t('settings.music')"
      @click="audioSettings.music = !audioSettings.music"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" fill="currentColor" />
        <circle cx="18" cy="16" r="3" fill="currentColor" />
      </svg>
    </button>
  </div>
</template>
