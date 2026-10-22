import { ref, watch } from 'vue';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'quiz-pro:theme';
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (THEMES as readonly string[]).includes(stored)) return stored as Theme;
  } catch {
    // Storage unavailable.
  }
  return 'system';
}

const theme = ref<Theme>(readTheme());

function apply(): void {
  const dark = theme.value === 'dark' || (theme.value === 'system' && (media?.matches ?? false));
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0e20' : '#f57c14');
}

watch(theme, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // The choice just won't persist.
  }
  apply();
});
media?.addEventListener('change', apply);
apply();

/** Light, dark or follow the operating system. Shared by the whole app. */
export function useTheme() {
  function cycle(): void {
    theme.value = THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length]!;
  }
  return { theme, cycle };
}
