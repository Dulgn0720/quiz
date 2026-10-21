<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useConfetti } from '@/composables/useConfetti';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  life: number;
}

const COLORS = ['#7c3aed', '#f43f5e', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#facc15'];
const canvas = ref<HTMLCanvasElement>();
const { bursts, take } = useConfetti();
let particles: Particle[] = [];
let frame = 0;

function launch(): void {
  const el = canvas.value;
  if (!el) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const b of take()) {
    for (let i = 0; i < b.count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 6 + Math.random() * 9;
      particles.push({
        x: b.x * w,
        y: b.y * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 6,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length]!,
        life: 1,
      });
    }
  }
  if (!frame) frame = requestAnimationFrame(step);
}

function step(): void {
  const el = canvas.value;
  const ctx = el?.getContext('2d');
  if (!el || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  if (el.width !== window.innerWidth * dpr) {
    el.width = window.innerWidth * dpr;
    el.height = window.innerHeight * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
  for (const p of particles) {
    p.vy += 0.25;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.spin;
    p.life -= 0.005;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  frame = particles.length > 0 ? requestAnimationFrame(step) : 0;
}

watch(() => bursts.value.length, (n) => n > 0 && launch());
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <canvas ref="canvas" class="pointer-events-none fixed inset-0 z-[60] h-full w-full" aria-hidden="true" />
</template>
