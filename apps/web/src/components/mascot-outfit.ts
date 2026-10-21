/** What «Агу» wears: the everyday Agula scarf, or a festive outfit for the season. */
export type MascotOutfit = 'scarf' | 'winter' | 'deel' | 'naadam';

/**
 * The outfit for a date (Mongolian holidays):
 * - 15 Dec – 7 Jan: winter hat for New Year;
 * - February: дээл and a festive hat around Цагаан сар (its date moves with the lunar calendar);
 * - 1 – 20 Jul: a wrestler's hat for Наадам;
 * - otherwise the Agula scarf.
 */
export function seasonalOutfit(date: Date = new Date()): MascotOutfit {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 12 && day >= 15) || (month === 1 && day <= 7)) return 'winter';
  if (month === 2) return 'deel';
  if (month === 7 && day <= 20) return 'naadam';
  return 'scarf';
}
