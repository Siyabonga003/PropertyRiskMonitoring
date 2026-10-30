/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hazard: {
          critical: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          safe: '#10b981',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-siren': 'sirenFlash 0.8s ease-in-out infinite alternate',
        'beacon': 'beaconPulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
      keyframes: {
        sirenFlash: {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 0.9)' },
          '100%': { backgroundColor: 'rgba(245, 158, 11, 0.35)', borderColor: 'rgba(245, 158, 11, 1)' }
        },
        beaconPulse: {
          '0%': { transform: 'scale(0.95)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0.8' }
        }
      }
    },
  },
  plugins: [],
}
