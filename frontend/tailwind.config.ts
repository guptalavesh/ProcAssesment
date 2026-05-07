import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-purple': '#a100ff',
        'brand-dark':   '#460073',
        'brand-mid':    '#7500c0',
        'bg-secondary': '#f3f0f8',
        'bg-muted':     '#ede9f4',
        'caption':      '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
