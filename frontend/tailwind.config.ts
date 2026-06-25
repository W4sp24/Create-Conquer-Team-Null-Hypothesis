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
        // Text on the dark forest page background (outside white cards)
        mist: {
          DEFAULT: '#ECEAE0',
          muted: '#AEBFAE',
        },
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
        // Secondary accents — used sparingly for badges / highlights
        gold: {
          DEFAULT: '#E0A458',
          soft: '#3A2F1E',
        },
        sky: {
          DEFAULT: '#5BA6B8',
          soft: '#1E3138',
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
        glow: '0 0 20px rgba(79, 174, 83, 0.3)',
        'glow-lg': '0 0 40px rgba(79, 174, 83, 0.4)',
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
        'slide-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(79, 174, 83, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(79, 174, 83, 0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        sparkle: {
          '0%, 100%': { opacity: '0', transform: 'scale(0) rotate(0deg)' },
          '50%': { opacity: '1', transform: 'scale(1) rotate(180deg)' },
        },
        stamp: {
          '0%': { opacity: '0', transform: 'scale(0.6) rotate(-8deg)' },
          '60%': { opacity: '1', transform: 'scale(1.08) rotate(2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        travel: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.5s ease-out both',
        'slide-in-up': 'slide-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'bounce-in': 'bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) both',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        sparkle: 'sparkle 1.5s ease-in-out infinite',
        stamp: 'stamp 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        travel: 'travel 1s linear infinite',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
} satisfies Config
