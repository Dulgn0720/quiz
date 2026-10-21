<script setup lang="ts">
import { computed } from 'vue';
import { seasonalOutfit, type MascotOutfit } from './mascot-outfit';

/**
 * «Агу» — Agula Quiz's snow-leopard mascot. Pure SVG + CSS, so it is crisp at any
 * size and costs nothing to load. Motion stops under prefers-reduced-motion.
 * The outfit follows the season unless one is given (дээл for Цагаан сар, a wrestler's
 * hat for Наадам, a winter hat around New Year).
 */
export type MascotMood =
  | 'idle'
  | 'happy'
  | 'sad'
  | 'thinking'
  | 'celebrate'
  | 'wave'
  | 'surprised'
  | 'sleepy'
  | 'nervous'
  | 'love'
  | 'dizzy'
  | 'cool';

const props = withDefaults(
  defineProps<{ mood?: MascotMood; size?: number; say?: string; outfit?: MascotOutfit | 'auto' }>(),
  { mood: 'idle', size: 120, say: undefined, outfit: 'auto' },
);

const wear = computed<MascotOutfit>(() => (props.outfit === 'auto' ? seasonalOutfit() : props.outfit));
const eyesClosedHappy = computed(() => props.mood === 'happy' || props.mood === 'celebrate');
const armUp = computed(() => props.mood === 'wave' || props.mood === 'celebrate');
const specialEyes = computed(() => ['sleepy', 'love', 'dizzy', 'cool'].includes(props.mood));
const scarf = computed(() =>
  wear.value === 'deel' ? { band: '#2457c5', tail: '#1b3f94', trim: '#f2c14e' } : { band: '#f57c14', tail: '#e2630a', trim: '' },
);
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
        <ellipse cx="100" cy="152" rx="46" ry="38" :fill="wear === 'deel' ? '#2f6fe0' : '#f1f2f7'" />
        <ellipse v-if="wear !== 'deel'" cx="100" cy="160" rx="27" ry="24" fill="#ffffff" />
        <template v-else>
          <!-- Дээл: diagonal opening with a gold trim and a sash -->
          <path d="M100 120 Q122 140 128 186" fill="none" stroke="#f2c14e" stroke-width="5" stroke-linecap="round" />
          <rect x="56" y="160" width="88" height="9" rx="4" fill="#f57c14" />
        </template>
        <template v-if="wear !== 'deel'">
          <circle cx="70" cy="146" r="4" fill="#c3c9db" />
          <circle cx="132" cy="140" r="4" fill="#c3c9db" />
          <circle cx="126" cy="168" r="3" fill="#c3c9db" />
        </template>

        <!-- Feet -->
        <ellipse cx="80" cy="188" rx="15" ry="9" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />
        <ellipse cx="120" cy="188" rx="15" ry="9" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />

        <!-- Arms -->
        <ellipse cx="62" cy="152" rx="10" ry="18" :fill="wear === 'deel' ? '#2f6fe0' : '#f1f2f7'" transform="rotate(18 62 152)" />
        <ellipse v-if="!armUp" cx="138" cy="152" rx="10" ry="18" :fill="wear === 'deel' ? '#2f6fe0' : '#f1f2f7'" transform="rotate(-18 138 152)" />

        <!-- Scarf (Agula orange) or дээл collar -->
        <path d="M60 116 Q100 132 140 116 L142 128 Q100 146 58 128 Z" :fill="scarf.band" />
        <path v-if="scarf.trim" d="M60 116 Q100 132 140 116" fill="none" :stroke="scarf.trim" stroke-width="3" />
        <path v-if="wear !== 'deel'" d="M118 126 L132 152 L120 154 L110 130 Z" :fill="scarf.tail" />

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
          <ellipse cx="72" cy="100" rx="8" ry="5" fill="#ffb3c1" :opacity="mood === 'love' ? 0.9 : 0.55" />
          <ellipse cx="128" cy="100" rx="8" ry="5" fill="#ffb3c1" :opacity="mood === 'love' ? 0.9 : 0.55" />
          <!-- Muzzle -->
          <ellipse cx="100" cy="103" rx="21" ry="15" fill="#ffffff" />
          <path d="M94 95 Q100 92 106 95 Q103 101 100 101 Q97 101 94 95 Z" fill="#e5788b" />

          <!-- Eyes -->
          <g v-if="mood === 'sleepy'" fill="none" stroke="#141a31" stroke-width="4" stroke-linecap="round">
            <path d="M74 84 Q82 89 90 84" />
            <path d="M110 84 Q118 89 126 84" />
          </g>
          <g v-else-if="mood === 'love'" class="m-love-eyes" fill="#e11d48">
            <path d="M82 90 C70 81 74 72 82 78 C90 72 94 81 82 90 Z" />
            <path d="M118 90 C106 81 110 72 118 78 C126 72 130 81 118 90 Z" />
          </g>
          <g v-else-if="mood === 'dizzy'" class="m-dizzy-eyes" fill="none" stroke="#141a31" stroke-width="3.5" stroke-linecap="round">
            <path d="M76 78 L88 90 M88 78 L76 90" />
            <path d="M112 78 L124 90 M124 78 L112 90" />
          </g>
          <g v-else-if="mood === 'cool'">
            <!-- Sunglasses -->
            <path d="M70 76 H96 V86 Q96 96 84 96 Q70 96 70 86 Z" fill="#141a31" />
            <path d="M104 76 H130 V86 Q130 96 118 96 Q104 96 104 86 Z" fill="#141a31" />
            <path d="M96 79 H104" stroke="#141a31" stroke-width="3" />
            <path d="M74 80 L80 80" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
            <path d="M108 80 L114 80" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
          </g>
          <g v-else-if="eyesClosedHappy" fill="none" stroke="#141a31" stroke-width="4.5" stroke-linecap="round">
            <path d="M74 84 Q82 75 90 84" />
            <path d="M110 84 Q118 75 126 84" />
          </g>
          <g v-else class="m-eyes">
            <ellipse cx="82" cy="82" :rx="mood === 'surprised' ? 8 : 6.5" :ry="mood === 'surprised' ? 10 : 8.5" fill="#141a31" />
            <ellipse cx="118" cy="82" :rx="mood === 'surprised' ? 8 : 6.5" :ry="mood === 'surprised' ? 10 : 8.5" fill="#141a31" />
            <circle cx="84.5" cy="78.5" r="2.4" fill="#ffffff" />
            <circle cx="120.5" cy="78.5" r="2.4" fill="#ffffff" />
          </g>
          <!-- Brows -->
          <g v-if="mood === 'sad' || mood === 'nervous'" stroke="#58668f" stroke-width="3" stroke-linecap="round">
            <path d="M74 70 L88 66" />
            <path d="M126 70 L112 66" />
          </g>
          <path v-if="mood === 'thinking'" d="M110 68 Q118 63 126 67" stroke="#58668f" stroke-width="3" stroke-linecap="round" fill="none" />

          <!-- Mouth -->
          <ellipse v-if="mood === 'celebrate' || mood === 'surprised'" cx="100" cy="110" rx="6" ry="7" fill="#c2415a" />
          <path v-else-if="mood === 'sad'" d="M91 113 Q100 106 109 113" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />
          <path v-else-if="mood === 'nervous'" d="M90 111 Q95 107 100 111 Q105 115 110 111" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />
          <path v-else-if="mood === 'thinking' || mood === 'dizzy'" d="M93 110 Q100 108 107 111" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />
          <ellipse v-else-if="mood === 'sleepy'" cx="100" cy="110" rx="3.5" ry="4" fill="#c2415a" />
          <path v-else-if="mood === 'cool'" d="M92 109 Q102 115 110 106" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />
          <path v-else d="M90 106 Q95 113 100 106 Q105 113 110 106" stroke="#141a31" stroke-width="3" stroke-linecap="round" fill="none" />

          <!-- Tear / sweat -->
          <path v-if="mood === 'sad'" class="m-tear" d="M126 92 Q130 100 126 104 Q122 100 126 92 Z" fill="#7cc4ff" />
          <path v-if="mood === 'nervous'" class="m-sweat" d="M140 58 Q146 68 140 72 Q134 68 140 58 Z" fill="#7cc4ff" />

          <!-- Seasonal hats -->
          <g v-if="wear === 'winter'" class="m-hat">
            <path d="M58 50 Q100 20 142 50 L150 10 Q118 6 58 50 Z" fill="#dc2626" />
            <rect x="56" y="44" width="88" height="12" rx="6" fill="#ffffff" />
            <circle cx="152" cy="10" r="8" fill="#ffffff" />
          </g>
          <g v-else-if="wear === 'naadam'" class="m-hat">
            <!-- Wrestler's pointed hat (жанжин малгай) -->
            <path d="M60 50 Q100 24 140 50 Z" fill="#1e3a8a" />
            <path d="M74 44 Q100 0 126 44 Z" fill="#dc2626" />
            <path d="M100 6 V-6" stroke="#f2c14e" stroke-width="4" stroke-linecap="round" />
            <circle cx="100" cy="-8" r="4" fill="#f2c14e" />
            <path d="M60 50 Q100 40 140 50" fill="none" stroke="#f2c14e" stroke-width="3" />
          </g>
          <g v-else-if="wear === 'deel'" class="m-hat">
            <!-- Round festive hat with a red knot (зангилаа) -->
            <path d="M62 48 Q100 10 138 48 Z" fill="#2457c5" />
            <path d="M58 48 Q100 36 142 48 L142 54 Q100 44 58 54 Z" fill="#7c3a12" />
            <circle cx="100" cy="18" r="6" fill="#dc2626" />
            <path d="M100 24 L94 40 M100 24 L106 40" stroke="#dc2626" stroke-width="3" stroke-linecap="round" />
          </g>
        </g>
      </g>

      <!-- Raised paw, drawn over the head -->
      <g v-if="armUp" class="m-arm">
        <ellipse cx="152" cy="112" rx="10" ry="20" :fill="wear === 'deel' ? '#2f6fe0' : '#f1f2f7'" stroke="#e1e4ee" stroke-width="1.5" transform="rotate(35 152 112)" />
        <circle cx="160" cy="96" r="9" fill="#ffffff" stroke="#e1e4ee" stroke-width="1.5" />
      </g>

      <!-- Props -->
      <g v-if="mood === 'thinking'" class="m-think">
        <circle cx="160" cy="44" r="18" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />
        <text x="160" y="52" text-anchor="middle" font-size="22" font-weight="800" fill="#f57c14" font-family="Unbounded, sans-serif">?</text>
        <circle cx="146" cy="68" r="4" fill="#ffffff" stroke="#e1e4ee" stroke-width="2" />
      </g>
      <g v-if="mood === 'sleepy'" class="m-zzz" font-family="Unbounded, sans-serif" font-weight="800" fill="#8fa3d9">
        <text x="146" y="46" font-size="16">z</text>
        <text x="158" y="32" font-size="20">z</text>
        <text x="172" y="16" font-size="24">Z</text>
      </g>
      <g v-if="mood === 'love'" class="m-hearts" fill="#f43f5e">
        <path d="M160 40 C152 34 154 26 160 30 C166 26 168 34 160 40 Z" />
        <path d="M36 56 C30 51 31 45 36 48 C41 45 42 51 36 56 Z" />
        <path d="M176 76 C170 71 171 65 176 68 C181 65 182 71 176 76 Z" />
      </g>
      <g v-if="mood === 'dizzy'" class="m-orbit">
        <path d="M60 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#fbbf24" />
        <path d="M140 26 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#fbbf24" />
        <path d="M100 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#f472b6" />
      </g>
      <g v-if="mood === 'celebrate' || mood === 'cool'" class="m-sparkles">
        <path d="M30 40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" fill="#fbbf24" />
        <path d="M170 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#f472b6" />
        <path d="M178 96 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#38bdf8" />
        <circle cx="24" cy="100" r="4" fill="#34d399" />
      </g>
    </svg>
    <p
      v-if="say"
      class="m-bubble relative mb-[45%] max-w-[16rem] rounded-2xl bg-white px-4 py-2 text-sm font-bold text-ink-900 shadow-soft ring-1 ring-ink-900/5 dark:bg-white/10 dark:text-white dark:ring-white/10"
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
.m-hat {
  transform-origin: 100px 50px;
}
.m-bubble {
  animation: m-bubble-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
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
.mood-celebrate .m-hat {
  animation: m-hat-bob 0.7s ease-in-out infinite;
}
.mood-sad .m-head {
  transform: translateY(4px) rotate(-4deg);
}
.mood-surprised .m-body {
  animation: m-jolt 0.5s ease-out 1;
}
.mood-sleepy .m-body {
  animation: m-breathe-deep 4s ease-in-out infinite;
}
.mood-sleepy .m-head {
  transform: rotate(6deg) translateY(3px);
}
.mood-nervous .m-body {
  animation: m-shiver 0.25s linear infinite;
}
.mood-love .m-body {
  animation: m-sway 1.6s ease-in-out infinite;
}
.mood-dizzy .m-head {
  animation: m-wobble 1.2s ease-in-out infinite;
}
.mood-cool .m-body {
  animation: m-groove 1s ease-in-out infinite;
}
.m-tear {
  animation: m-drip 2s ease-in infinite;
}
.m-sweat {
  animation: m-drip 1.4s ease-in infinite;
}
.m-think {
  animation: m-float 2.4s ease-in-out infinite;
}
.m-zzz text {
  animation: m-zzz 2.4s ease-in-out infinite;
}
.m-zzz text:nth-child(2) {
  animation-delay: 0.4s;
}
.m-zzz text:nth-child(3) {
  animation-delay: 0.8s;
}
.m-love-eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: m-beat 0.8s ease-in-out infinite;
}
.m-hearts path {
  transform-box: fill-box;
  transform-origin: center;
  animation: m-rise 2.2s ease-in infinite;
}
.m-hearts path:nth-child(2) {
  animation-delay: 0.7s;
}
.m-hearts path:nth-child(3) {
  animation-delay: 1.4s;
}
.m-orbit {
  transform-origin: 100px 40px;
  animation: m-spin 2s linear infinite;
}
.m-sparkles {
  transform-origin: 100px 100px;
  animation: m-twinkle 1.2s ease-in-out infinite;
}

@keyframes m-breathe {
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.015, 0.985); }
}
@keyframes m-breathe-deep {
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.04, 0.97); }
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
@keyframes m-hat-bob {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg) translateY(-3px); }
}
@keyframes m-jolt {
  0% { transform: translateY(0); }
  30% { transform: translateY(-14px) scale(1.04); }
  100% { transform: translateY(0); }
}
@keyframes m-shiver {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1.5px); }
  75% { transform: translateX(1.5px); }
}
@keyframes m-sway {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes m-wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  75% { transform: rotate(8deg); }
}
@keyframes m-groove {
  0%, 100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(-4px) rotate(-2deg); }
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
@keyframes m-zzz {
  0% { opacity: 0; transform: translate(0, 6px); }
  40% { opacity: 1; }
  100% { opacity: 0; transform: translate(6px, -8px); }
}
@keyframes m-beat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}
@keyframes m-rise {
  0% { opacity: 0; transform: translateY(8px) scale(0.6); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-22px) scale(1.1); }
}
@keyframes m-spin {
  to { transform: rotate(360deg); }
}
@keyframes m-twinkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.06); }
}
@keyframes m-bubble-in {
  from { opacity: 0; transform: translateY(6px) scale(0.9); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .mascot :is(.m-body, .m-eyes, .m-tail, .m-arm, .m-head, .m-hat, .m-tear, .m-sweat, .m-think, .m-love-eyes, .m-orbit, .m-sparkles, .m-bubble),
  .mascot .m-zzz text,
  .mascot .m-hearts path {
    animation: none !important;
  }
}
</style>
