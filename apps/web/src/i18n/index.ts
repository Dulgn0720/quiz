import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@quiz/shared';
import { createI18n } from 'vue-i18n';
import en from './en';
import mn from './mn';

const STORAGE_KEY = 'quiz-pro:locale';

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return DEFAULT_LOCALE;
}

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: 'en',
  messages: { mn, en },
});

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore: the choice just won't persist.
  }
}

document.documentElement.lang = i18n.global.locale.value;
