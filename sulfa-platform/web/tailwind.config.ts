import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: { 50: '#eefaf4', 100: '#dff5eb', 200: '#bfe9d6', 300: '#8fd6b8', 400: '#3fb68a', 500: '#0d9a6d', 600: '#087f5b', 700: '#066447', 800: '#064e3b', 900: '#063b32', 950: '#03241e' },
        gold: { 100: '#f8f0dc', 200: '#efdfb6', 300: '#e3c98a', 400: '#d6b36a', 500: '#c49a45', 600: '#a27c2f' },
        ink: { DEFAULT: '#172b27', soft: '#3c514b', muted: '#71817b' },
        paper: '#f7f9f8',
        line: '#e3ebe7',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', '"Readex Pro Variable"', 'system-ui', 'sans-serif'],
        display: ['"Readex Pro Variable"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        latin: ['"Readex Pro Variable"', 'system-ui', 'sans-serif'],
        num: ['"Inter Variable"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(6,59,50,.06), 0 12px 32px rgba(6,59,50,.07)', lift: '0 24px 70px rgba(6,59,50,.14)' },
      borderRadius: { xl2: '1.25rem' },
      keyframes: { rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } } },
      animation: { rise: 'rise .35s cubic-bezier(.2,.8,.2,1) both' },
    },
  },
  plugins: [],
} satisfies Config;
