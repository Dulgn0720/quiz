import { ref } from 'vue';

export interface RainDrop {
  id: number;
  emoji: string;
  /** Horizontal start, % of the viewport width. */
  x: number;
  delay: number;
  duration: number;
  size: number;
  spin: number;
}

const drops = ref<RainDrop[]>([]);
let nextId = 1;

/** Emoji falling across the whole screen (🎉 for a perfect round, 🔥 for a hot streak). Rendered by <EmojiRainLayer>. */
export function useEmojiRain() {
  function rain(emojis: string | string[], count = 36): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const list = Array.isArray(emojis) ? emojis : [emojis];
    const batch: RainDrop[] = Array.from({ length: count }, (_, i) => ({
      id: nextId++,
      emoji: list[i % list.length]!,
      x: Math.random() * 96 + 2,
      delay: Math.random() * 1.2,
      duration: 2.2 + Math.random() * 1.6,
      size: 1.6 + Math.random() * 1.8,
      spin: (Math.random() - 0.5) * 540,
    }));
    drops.value = [...drops.value, ...batch].slice(-120);
    setTimeout(() => {
      const ids = new Set(batch.map((d) => d.id));
      drops.value = drops.value.filter((d) => !ids.has(d.id));
    }, 4500);
  }
  return { drops, rain };
}
