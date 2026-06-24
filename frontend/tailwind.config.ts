import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F5EE',
        panel: '#FFFFFF',
        cream: '#F1EDE2',
        hairline: '#E7E3D7',
        primary: '#1A1A16',
        secondary: '#6B6B5F',
        forest: {
          DEFAULT: '#2F5233',
          deep: '#1A3320',
          ink: '#13241A',
        },
        leaf: {
          DEFAULT: '#4FAE53',
          bright: '#5FBF63',
          soft: '#EAF1E7',
        },
        accent: {
          DEFAULT: '#2F5233',
          muted: '#EAF1E7',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        headline: '-0.02em',
        label: '0.14em',
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,51,32,0.04), 0 14px 32px -18px rgba(26,51,32,0.22)',
        'card-hover':
          '0 2px 4px rgba(26,51,32,0.06), 0 22px 44px -20px rgba(26,51,32,0.30)',
        feature: '0 24px 60px -24px rgba(19,36,26,0.55)',
      },
      fontSize: {
        label: ['11px', { lineHeight: '1', letterSpacing: '0.14em' }],
        body: ['15px', { lineHeight: '1.55' }],
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config
