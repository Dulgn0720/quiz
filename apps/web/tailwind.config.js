/** Deep navy used for text and dark surfaces (also replaces Tailwind's slate, so every screen shares it). */
const ink = {
  50: '#f5f7fb',
  100: '#eceff7',
  200: '#d6dcec',
  300: '#b0bad6',
  400: '#7d8bb3',
  500: '#58668f',
  600: '#414d74',
  700: '#323c5d',
  800: '#1f2642',
  900: '#141a31',
  950: '#0a0e20',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        grow: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.06)' },
        },
        rise: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        grow: 'grow 600ms ease-out',
        pop: 'pop 450ms ease-out',
        float: 'float 18s ease-in-out infinite',
        rise: 'rise 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
      colors: {
        // Agula orange, from the logo.
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb9a3c',
          500: '#f57c14',
          600: '#e2630a',
          700: '#bb4a0b',
          800: '#953b11',
          900: '#793311',
          950: '#421706',
        },
        ink,
        slate: ink,
      },
      boxShadow: {
        glow: '0 10px 40px -10px rgb(245 124 20 / 0.55)',
        soft: '0 1px 2px rgb(10 14 32 / 0.04), 0 8px 24px -8px rgb(10 14 32 / 0.12)',
      },
    },
  },
  plugins: [],
};
