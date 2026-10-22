import { ref } from 'vue';

export interface ConfettiBurst {
  id: number;
  /** Particles to launch. */
  count: number;
  /** Launch point as a fraction of the viewport (0–1). */
  x: number;
  y: number;
}

const bursts = ref<ConfettiBurst[]>([]);
let nextId = 1;

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fire-and-forget confetti, rendered by the single <ConfettiLayer> in App.vue. */
export function useConfetti() {
  function burst(options: Partial<Omit<ConfettiBurst, 'id'>> = {}): void {
    if (reducedMotion()) return;
    bursts.value.push({ id: nextId++, count: 120, x: 0.5, y: 0.35, ...options });
  }

  /** A bigger show: several bursts across the screen. */
  function celebrate(): void {
    [0.2, 0.5, 0.8].forEach((x, i) => setTimeout(() => burst({ x, y: 0.3, count: 150 }), i * 250));
  }

  function take(): ConfettiBurst[] {
    return bursts.value.splice(0);
  }

  return { bursts, burst, celebrate, take };
}
