<script setup lang="ts">
import { audioSettings } from '@/game/sound';

defineProps<{ music?: boolean }>();
</script>

<template>
  <div class="flex items-center">
    <button
      type="button"
      class="btn-icon text-lg"
      :aria-pressed="audioSettings.sfx"
      :aria-label="$t('settings.sound')"
      :title="$t('settings.sound')"
      @click="audioSettings.sfx = !audioSettings.sfx"
    >
      <span aria-hidden="true">{{ audioSettings.sfx ? '🔊' : '🔇' }}</span>
    </button>
    <button
      v-if="music"
      type="button"
      class="btn-icon text-lg"
      :class="audioSettings.music ? '' : 'opacity-40'"
      :aria-pressed="audioSettings.music"
      :aria-label="$t('settings.music')"
      :title="$t('settings.music')"
      @click="audioSettings.music = !audioSettings.music"
    >
      <span aria-hidden="true">🎵</span>
    </button>
  </div>
</template>
