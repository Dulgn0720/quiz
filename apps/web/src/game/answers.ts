/** Colours and shapes for answer tiles, so options are told apart at a glance (and not by colour alone). */
export const TILE_STYLES = [
  { bg: 'bg-rose-500', ring: 'ring-rose-300', shape: '▲' },
  { bg: 'bg-sky-500', ring: 'ring-sky-300', shape: '◆' },
  { bg: 'bg-amber-500', ring: 'ring-amber-300', shape: '●' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-300', shape: '■' },
  { bg: 'bg-violet-500', ring: 'ring-violet-300', shape: '★' },
  { bg: 'bg-pink-500', ring: 'ring-pink-300', shape: '⬢' },
] as const;

export function tileStyle(index: number) {
  return TILE_STYLES[index % TILE_STYLES.length]!;
}
