import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#060a0d',
          panel: '#0b1116',
          edge: '#1a242c',
          dim: '#5c6b75',
          text: '#c9d6dd',
        },
        up: '#00e676',
        down: '#ff5252',
        gold: '#ffd166',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-display)', 'sans-serif'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-7px) rotate(-0.4deg)' },
          '30%': { transform: 'translateX(6px) rotate(0.3deg)' },
          '45%': { transform: 'translateX(-5px)' },
          '60%': { transform: 'translateX(4px)' },
          '75%': { transform: 'translateX(-2px)' },
        },
        flashup: {
          '0%': { opacity: '0.35' },
          '100%': { opacity: '0' },
        },
        pulseglow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        risein: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shake: 'shake 0.5s ease-in-out',
        flashup: 'flashup 0.9s ease-out forwards',
        pulseglow: 'pulseglow 1.6s ease-in-out infinite',
        risein: 'risein 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}

export default config
