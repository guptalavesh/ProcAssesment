import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── AIVault accent (cobalt) ─────────────────────────────────────
        accent: {
          50:  '#EEF2FF',
          100: '#D9E1FF',
          200: '#B3C2FF',
          300: '#7E92FF',
          400: '#4F6AFF',
          500: '#2251FF',
          600: '#1A41E0',
          700: '#1632B0',
          800: '#102484',
          900: '#0A1759',
          DEFAULT: '#2251FF',
        },
        // ── Cool neutral scale (faint blue cast) ────────────────────────
        neutral: {
          0:   '#FFFFFF',
          25:  '#FCFCFD',
          50:  '#F8F9FB',
          100: '#F1F3F7',
          150: '#E7EAF1',
          200: '#D8DDE7',
          300: '#BCC3D2',
          400: '#8F98AC',
          500: '#64708A',
          600: '#475266',
          700: '#2F3849',
          800: '#1C2230',
          900: '#0F141C',
          950: '#070A10',
        },
        // ── Status (Lightspeed-ish) ─────────────────────────────────────
        success: { soft: '#ECFDF3', DEFAULT: '#039855', fg: '#027A48' },
        warning: { soft: '#FFFAEB', DEFAULT: '#DC6803', fg: '#B54708' },
        danger:  { soft: '#FEF3F2', DEFAULT: '#D92D20', fg: '#B42318' },
        info:    { soft: '#EFF8FF', DEFAULT: '#1570EF', fg: '#175CD3' },
        // ── Agent surface (4% navy wash) ────────────────────────────────
        agent: {
          surface: '#F1F4FF',
          border:  '#DCE3FF',
          fg:      '#1632B0',
        },
        // ── Legacy aliases (kept so existing class names cascade) ───────
        // brand-purple/dark/mid → cobalt scale; bg-* → cool neutrals
        'brand-purple': '#2251FF',
        'brand-dark':   '#0F141C',
        'brand-mid':    '#1A41E0',
        'bg-secondary': '#F1F3F7',
        'bg-muted':     '#E7EAF1',
        'caption':      '#64708A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xs: '3px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(15, 20, 28, 0.04)',
        sm: '0 1px 2px 0 rgba(15, 20, 28, 0.05), 0 1px 3px 0 rgba(15, 20, 28, 0.06)',
        md: '0 2px 4px -1px rgba(15, 20, 28, 0.06), 0 4px 8px -2px rgba(15, 20, 28, 0.08)',
        lg: '0 4px 8px -2px rgba(15, 20, 28, 0.06), 0 12px 24px -4px rgba(15, 20, 28, 0.10)',
        xl: '0 8px 16px -4px rgba(15, 20, 28, 0.08), 0 24px 48px -8px rgba(15, 20, 28, 0.14)',
        focus: '0 0 0 3px rgba(34, 81, 255, 0.20)',
      },
      transitionTimingFunction: {
        'ease-out-quiet': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config
