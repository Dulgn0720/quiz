<script setup lang="ts">
import type { LevelProgress } from '@quiz/shared';

defineProps<{ progress: LevelProgress; xp: number }>();
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between text-sm font-bold">
      <span class="text-brand-700 dark:text-brand-300">{{ $t('profile.level', { n: progress.level }) }}</span>
      <span class="tabular-nums text-slate-500 dark:text-slate-400">
        <template v-if="progress.needed > 0">{{ progress.current }} / {{ progress.needed }} XP</template>
        <template v-else>{{ xp }} XP</template>
      </span>
    </div>
    <div
      class="mt-1 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="progressbar"
      :aria-valuenow="Math.round(progress.fraction * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="$t('profile.levelProgress')"
    >
      <div class="h-full rounded-full bg-gradient-to-r from-brand-500 to-pink-500 transition-all duration-700" :style="{ width: `${progress.fraction * 100}%` }" />
    </div>
  </div>
</template>
