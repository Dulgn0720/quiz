<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** Rotating "did you know?" tips about the rules, shown while players wait in the lobby. */
const props = withDefaults(defineProps<{ intervalMs?: number; size?: 'md' | 'lg' }>(), { intervalMs: 7000, size: 'md' });
const { tm, rt } = useI18n();

const tips = computed(() => {
  const list = tm('game.tips.items') as unknown[];
  return Array.isArray(list) ? list.map((item) => rt(item as Parameters<typeof rt>[0])) : [];
});
const index = ref(Math.floor(Math.random() * 100));
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => (timer = setInterval(() => (index.value += 1), props.intervalMs)));
onBeforeUnmount(() => clearInterval(timer));

const tip = computed(() => (tips.value.length ? tips.value[index.value % tips.value.length] : ''));
</script>

<template>
  <div
    v-if="tip"
    class="relative mx-auto w-full overflow-hidden rounded-2xl bg-white/[0.06] text-left ring-1 ring-white/10"
    :class="size === 'lg' ? 'max-w-3xl px-6 py-4' : 'max-w-md px-4 py-3'"
    aria-live="polite"
  >
    <p class="font-bold uppercase tracking-wide text-brand-300" :class="size === 'lg' ? 'text-sm' : 'text-xs'">💡 {{ $t('game.tips.title') }}</p>
    <Transition name="tip" mode="out-in">
      <p :key="index" class="mt-1 font-semibold text-slate-100" :class="size === 'lg' ? 'text-2xl' : 'text-base'">{{ tip }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.tip-enter-active,
.tip-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.tip-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.tip-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
