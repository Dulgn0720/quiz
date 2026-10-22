/**
 * Numbers as players read them. Digits are grouped only from 10 000 up, so
 * years (1921) and small counts stay as written.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('mn-MN', { maximumFractionDigits: 6, useGrouping: Math.abs(n) >= 10_000 });
}
