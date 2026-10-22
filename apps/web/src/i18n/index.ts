import { createI18n } from 'vue-i18n';
import mn from './mn';

/** The app speaks Mongolian only (everyday office Mongolian, with common terms such as «Quiz» in English). */
export const i18n = createI18n({
  legacy: false,
  locale: 'mn',
  messages: { mn },
});

document.documentElement.lang = 'mn';
