<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useToast } from '@/composables/useToast';

const { toasts, dismiss } = useToast();
const tones = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-slate-800',
} as const;
const route = useRoute();
</script>

<template>
  <!-- Game screens have controls at the bottom, so toasts appear at the top there. -->
  <div
    class="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
    :class="route.meta.fullscreen ? 'top-4' : 'bottom-4'"
    aria-live="polite"
  >
    <TransitionGroup
      enter-from-class="translate-y-4 opacity-0"
      leave-to-class="opacity-0"
      enter-active-class="transition duration-200"
      leave-active-class="transition duration-200"
    >
      <button
        v-for="toast in toasts"
        :key="toast.id"
        type="button"
        class="pointer-events-auto max-w-md rounded-xl px-4 py-3 text-left text-sm font-bold text-white shadow-lg"
        :class="tones[toast.tone]"
        @click="dismiss(toast.id)"
      >
        {{ toast.message }}
      </button>
    </TransitionGroup>
  </div>
</template>
