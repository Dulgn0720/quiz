/**
 * Colours and shapes for answer tiles, so options are told apart at a glance (and not by colour alone).
 * `fg` keeps text readable on each gradient (white on the -600/-700 stops passes WCAG AA for large text).
 */
export const TILE_STYLES = [
  { bg: 'bg-gradient-to-br from-rose-600 to-pink-700 shadow-rose-600/30', fg: 'text-white', ring: 'ring-rose-300', shape: '▲' },
  { bg: 'bg-gradient-to-br from-sky-600 to-blue-700 shadow-sky-600/30', fg: 'text-white', ring: 'ring-sky-300', shape: '◆' },
  { bg: 'bg-gradient-to-br from-amber-300 to-brand-500 shadow-amber-500/30', fg: 'text-ink-950', ring: 'ring-amber-200', shape: '●' },
  { bg: 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-600/30', fg: 'text-white', ring: 'ring-emerald-300', shape: '■' },
  { bg: 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/30', fg: 'text-white', ring: 'ring-violet-300', shape: '★' },
  { bg: 'bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-fuchsia-500/30', fg: 'text-white', ring: 'ring-fuchsia-300', shape: '⬢' },
] as const;

export function tileStyle(index: number) {
  return TILE_STYLES[index % TILE_STYLES.length]!;
}
