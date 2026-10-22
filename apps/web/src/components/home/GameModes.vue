<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';

/** The ways to play, as big inviting tiles on the home page. */
const auth = useAuthStore();

const modes = [
  { key: 'live', icon: '🎮', to: '/quizzes', gradient: 'from-brand-500 via-orange-500 to-amber-400' },
  { key: 'survival', icon: '💀', to: '/survival', gradient: 'from-rose-500 via-pink-600 to-fuchsia-600' },
  { key: 'practice', icon: '🎯', to: '/quizzes', gradient: 'from-sky-500 via-blue-600 to-indigo-600' },
  { key: 'word', icon: '🔤', to: '/word', gradient: 'from-lime-500 via-emerald-500 to-green-700' },
  { key: 'daily', icon: '📅', to: '#daily', gradient: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { key: 'trainings', icon: '🎓', to: '/trainings', gradient: 'from-violet-500 via-purple-600 to-indigo-700' },
] as const;

function target(mode: (typeof modes)[number]) {
  if (mode.key === 'trainings' && !auth.user) return { name: 'login', query: { redirect: '/trainings' } };
  return mode.to;
}
</script>

<template>
  <section class="mt-14 sm:mt-16" :aria-label="$t('modes.title')">
    <h2 class="text-2xl font-bold sm:text-3xl">{{ $t('modes.title') }}</h2>
    <p class="mt-1 text-ink-600 dark:text-ink-300">{{ $t('modes.subtitle') }}</p>
    <ul class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      <li v-for="(m, i) in modes" :key="m.key">
        <component
          :is="m.to.startsWith('#') ? 'a' : 'RouterLink'"
          v-bind="m.to.startsWith('#') ? { href: m.to } : { to: target(m) }"
          class="mode group relative flex h-full min-h-40 flex-col overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
          :class="m.gradient"
          :style="{ animationDelay: `${i * 70}ms` }"
        >
          <span class="shine" aria-hidden="true" />
          <span class="mode-icon text-5xl drop-shadow-lg transition duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true">{{ m.icon }}</span>
          <span class="mt-auto pt-6 font-display text-lg font-bold leading-tight">{{ $t(`modes.${m.key}.name`) }}</span>
          <span class="mt-1 text-sm text-white/85">{{ $t(`modes.${m.key}.text`) }}</span>
        </component>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.mode {
  animation: mode-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}
.mode-icon {
  animation: bob 3.2s ease-in-out infinite;
}
.mode:nth-child(odd) .mode-icon {
  animation-delay: -1.6s;
}
/* A soft light sweep across the tile on hover. */
.shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.28) 50%, transparent 70%);
  transform: translateX(-120%);
  transition: transform 0.8s ease;
  pointer-events: none;
}
.mode:hover .shine {
  transform: translateX(120%);
}
@keyframes mode-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.97);
  }
}
@keyframes bob {
  50% {
    transform: translateY(-6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mode,
  .mode-icon {
    animation: none;
  }
  .shine {
    display: none;
  }
}
</style>
