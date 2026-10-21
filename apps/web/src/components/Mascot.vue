<script setup lang="ts">
import { computed } from 'vue';

/**
 * «Агу» — Agula Quiz's snow-leopard mascot. Pure SVG + CSS, so it is crisp at any
 * size and costs nothing to load. Motion stops under prefers-reduced-motion.
 */
export type MascotMood = 'idle' | 'happy' | 'sad' | 'thinking' | 'celebrate' | 'wave' | 'surprised';

const props = withDefaults(defineProps<{ mood?: MascotMood; size?: number; say?: string }>(), {
  mood: 'idle',
  size: 120,
  say: undefined,
});

const eyesClosedHappy = computed(() => props.mood === 'happy' || props.mood === 'celebrate');
const armUp = computed(() => props.mood === 'wave' || props.mood === 'celebrate');
</script>

<template>
  <div class="mascot inline-flex items-end gap-2" :class="`mood-${mood}`">
    <svg :width="size" :height="size" viewBox="0 0 200 200" role="img" :aria-label="say ?? $t('mascot.name')" class="shrink-0 overflow-visible">
      <g class="m-body">
        <!-- Tail -->
        <path class="m-tail" d="M138 168 C178 170 186 132 168 112" fill="none" stroke="#e7e8ef" stroke-width="18" stroke-linecap="round" />
        <circle cx="172" cy="128" r="3.5" fill="#9aa3bd" />
        <circle cx="164" cy="152" r="3.5" fill="#9aa3bd" />

        <!-- Body -->
        <ellipse cx="100" cy="152" rx="46" ry="38" fill="#f1f2f7" />
        <ellipse cx="100" cy="160" rx="27" ry="24" fill="#ffffff" />
        <circle cx="70" cy="146" r="4" fill="#c3c9db" />
        <circle cx="132" cy="140" r="4" fill="#c3c9db" />
        <circle cx="126" cy="168" r="3" fill="#c3c9db" />

        <!-- Feet -->
        <ellipse cx="80" cy="188" rx="15" ry="9" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />
        <ellipse cx="120" cy="188" rx="15" ry="9" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />

        <!-- Arms -->
        <ellipse cx="62" cy="152" rx="10" ry="18" fill="#f1f2f7" transform="rotate(18 62 152)" />
        <ellipse v-if="!armUp" cx="138" cy="152" rx="10" ry="18" fill="#f1f2f7" transform="rotate(-18 138 152)" />

        <!-- Agula scarf -->
        <path d="M60 116 Q100 132 140 116 L142 128 Q100 146 58 128 Z" fill="#f57c14" />
        <path d="M118 126 L132 152 L120 154 L110 130 Z" fill="#e2630a" />

        <!-- Head -->
        <g class="m-head">
          <circle cx="66" cy="50" r="15" fill="#f1f2f7" />
          <circle cx="134" cy="50" r="15" fill="#f1f2f7" />
          <circle cx="66" cy="51" r="7.5" fill="#f8b4c2" />
          <circle cx="134" cy="51" r="7.5" fill="#f8b4c2" />
          <circle cx="100" cy="84" r="46" fill="#f4f5fa" />
          <!-- Rosettes -->
          <circle cx="84" cy="50" r="4" fill="#c3c9db" />
          <circle cx="100" cy="44" r="4.5" fill="#c3c9db" />
          <circle cx="116" cy="50" r="4" fill="#c3c9db" />
          <circle cx="62" cy="84" r="3.5" fill="#c3c9db" />
          <circle cx="138" cy="84" r="3.5" fill="#c3c9db" />
          <!-- Cheeks -->
          <ellipse cx="72" cy="100" rx="8" ry="5" fill="#ffb3c1" opacity="0.55" />
          <ellipse cx="128" cy="100" rx="8" ry="5" fill="#ffb3c1" opacity="0.55" />
          <!-- Muzzle -->
          <ellipse cx="100" cy="103" rx="21" ry="15" fill="#ffffff" />
          <path d="M94 95 Q100 92 106 95 Q103 101 100 101 Q97 101 94 95 Z" fill="#e5788b" />

          <!-- Eyes -->
          <g v-if="eyesClosedHappy" fill="none" stroke="#141a31" stroke-width="4.5" stroke-linecap="round">
            <path d="M74 84 Q82 75 90 84" />
            <path d="M110 84 Q118 75 126 84" />
          </g>
          <g v-else class="m-eyes">
            <ellipse cx="82" cy="82" :rx="mood === 'surprised' ? 8 : 6.5" :ry="mood === 'surprised' ? 10 : 8.5" fill="#141a31" />
            <ellipse cx="118" cy="82" :rx="mood === 'surprised' ? 8 : 6.5" :ry="mood === 'surprised' ? 10 : 8.5" fill="#141a31" />
            <circle cx="84.5" cy="78.5" r="2.4" fill="#ffffff" />
            <circle cx="120.5" cy="78.5" r="2.4" fill="#ffffff" />
          </g>
          <!-- Brows for sad / thinking -->
          <g v-if="mood === 'sad'" stroke="#58668f" stroke-width="3" stroke-linecap="round">
            <path d="M74 70 L88 66" />
            <path d="M126 70 L112 66" />
          </g>
          <path v-if="mood === 'thinking'" d="M110 68 Q118 63 126 67" stroke="#58668f" stroke-width="3" stroke-linecap="round" fill="none" />

          <!-- Mouth -->
          <ellipse v-if="mood === 'celebrate' || mood === 'surprised'" cx="100" cy="110" rx="6" ry="7" fill="#c2415a" />
          <path v-else-if="mood === 'sad'" d="M91 113 Q100 106 109 113" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />
          <path v-else-if="mood === 'thinking'" d="M93 110 Q100 108 107 111" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />
          <path v-else d="M90 106 Q95 113 100 106 Q105 113 110 106" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />

          <!-- Tear -->
          <path v-if="mood === 'sad'" class="m-tear" d="M126 92 Q130 100 126 104 Q122 100 126 92 Z" fill="#7cc4ff" />
        </g>
      </g>

      <!-- Raised paw, drawn over the head -->
      <g v-if="armUp" class="m-arm">
        <ellipse cx="152" cy="112" rx="10" ry="20" fill="#f1f2f7" stroke="#e1e4ee" stroke-width="1.5" transform="rotate(35 152 112)" />
        <circle cx="160" cy="96" r="9" fill="#ffffff" stroke="#e1e4ee" stroke-width="1.5" />
      </g>

      <!-- Props -->
      <g v-if="mood === 'thinking'" class="m-think">
        <circle cx="160" cy="44" r="18" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />
        <text x="160" y="52" text-anchor="middle" font-size="22" font-weight="800" fill="#f57c14" font-family="Unbounded, sans-serif">?</text>
        <circle cx="146" cy="68" r="4" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />
      </g>
      <g v-if="mood === 'celebrate'" class="m-sparkles">
        <path d="M30 40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" fill="#fbbf24" />
        <path d="M170 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#f472b6" />
        <path d="M178 96 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#38bdf8" />
        <circle cx="24" cy="100" r="4" fill="#34d399" />
      </g>
    </svg>
    <p
      v-if="say"
      class="relative mb-[45%] max-w-[16rem] rounded-2xl bg-white px-4 py-2 text-sm font-bold text-ink-900 shadow-soft ring-1 ring-ink-900/5 dark:bg-white/10 dark:text-white dark:ring-white/10"
    >
      {{ say }}
    </p>
  </div>
</template>

<style scoped>
.m-body {
  transform-origin: 100px 196px;
  animation: m-breathe 3.2s ease-in-out infinite;
}
.m-eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: m-blink 4.5s infinite;
}
.m-tail {
  transform-origin: 140px 168px;
  animation: m-tail 2.6s ease-in-out infinite;
}
.m-arm {
  transform-origin: 138px 132px;
  animation: m-wave 0.9s ease-in-out infinite;
}
.m-head {
  transform-origin: 100px 120px;
}
.mood-thinking .m-head {
  animation: m-tilt 3s ease-in-out infinite;
}
.mood-happy .m-body {
  animation: m-hop 0.9s ease-in-out infinite;
}
.mood-celebrate .m-body {
  animation: m-dance 0.7s ease-in-out infinite;
}
.mood-sad .m-head {
  transform: translateY(4px) rotate(-4deg);
}
.mood-surprised .m-body {
  animation: m-jolt 0.5s ease-out 1;
}
.m-tear {
  animation: m-drip 2s ease-in infinite;
}
.m-think {
  animation: m-float 2.4s ease-in-out infinite;
}
.m-sparkles {
  transform-origin: 100px 100px;
  animation: m-twinkle 1.2s ease-in-out infinite;
}

@keyframes m-breathe {
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.015, 0.985); }
}
@keyframes m-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}
@keyframes m-tail {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-8deg); }
}
@keyframes m-wave {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-22deg); }
}
@keyframes m-tilt {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-7deg); }
}
@keyframes m-hop {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-10px); }
}
@keyframes m-dance {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-12px) rotate(5deg); }
}
@keyframes m-jolt {
  0% { transform: translateY(0); }
  30% { transform: translateY(-14px) scale(1.04); }
  100% { transform: translateY(0); }
}
@keyframes m-drip {
  0% { transform: translateY(0); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(26px); opacity: 0; }
}
@keyframes m-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes m-twinkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.06); }
}
</style>
