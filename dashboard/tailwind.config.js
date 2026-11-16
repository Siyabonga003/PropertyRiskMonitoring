/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // 60% — navy: page canvas, header, summary panels
        navy: {
          950: '#060C1F',
          900: '#0B1633',
          800: '#12214A',
          700: '#1A2D63',
          600: '#2A417F',
        },
        // 30% — white and its supporting neutrals: data cards, tables, dialogs
        line: '#DCE2EF',
        mist: '#F2F5FB',
        ink: { muted: '#53607F' },
        haze: '#A8B5D6', // secondary text on navy
        // 10% — hot pink: interactive controls only
        pink: {
          DEFAULT: '#FF2E88',
          light: '#FF5C9F',
          dark: '#E01672',
          deep: '#C4005B', // pink text on white (AA contrast)
        },
        // Safety status colours. Small, functional, never used for controls.
        status: {
          critical: '#D7263D',
          warn: '#E8A100',
          ok: '#139A5B',
          'critical-soft': '#FDE8EB',
          'warn-soft': '#FFF3D6',
          'ok-soft': '#DDF5E8',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(6, 12, 31, 0.12), 0 4px 16px rgba(6, 12, 31, 0.10)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'dot-pulse': 'dotPulse 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        dotPulse: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
    },
  },
  plugins: [],
}
