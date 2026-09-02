/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],

  theme: {
    extend: {
      colors: {
        // Primary — "do this". Reserved for the one action per view + key numbers.
        fox: {
          50: '#FFF1EA',
          100: '#FFE1D1',
          200: '#FFC3A6',
          300: '#FF9E74',
          400: '#FF7642',
          500: '#FF4D00',
          600: '#E04400',
          700: '#B83700',
          800: '#8C2A00',
          900: '#5E1D00',
        },
        // Secondary — "you're on track". Guidance cues only: tips, progress, done.
        sage: {
          50: '#EEF3F0',
          100: '#DCE8E1',
          200: '#BAD1C4',
          300: '#93B6A2',
          400: '#719A81',
          500: '#5B8A72',
          600: '#48705C',
          700: '#3B5C4B',
          800: '#2C4539',
          900: '#1E2F27',
        },
        // Warm neutrals — a touch warmer + more saturated than before. Names unchanged.
        // warm-400 darkened 2026-09-02: #9C968A only hit 2.8:1 on the warm-white
        // ground and was used as body/secondary text in 270+ places. #6E6860 is
        // 5.2:1 (WCAG AA). warm-300 stays light — it's borders + decoration only.
        warm: {
          white: '#FAF8F5',
          50: '#F5F3EF',
          100: '#EDEAE4',
          200: '#DEDAD1',
          300: '#C6C1B5',
          400: '#6E6860',
          500: '#5E594F',
          600: '#57524A',
          700: '#3E3A34',
          800: '#2A2723',
          900: '#1A1918',
        },
        success: { 50: '#E9F2EB', 500: '#4E8A5B', 700: '#2E5638' },
        warning: { 50: '#FAEFDD', 500: '#D98E2B', 700: '#7A4E12' },
        danger:  { 50: '#FBEAE9', 500: '#D6483F', 700: '#7E241E' },
        info:    { 50: '#E8F0F6', 500: '#3E7CB1', 700: '#1F4462' },
      },

      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"Bricolage Grotesque"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Calm Guidance scale (see DESIGN.md)
        'display-2xl': ['3.5rem',   { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-xl':  ['2.75rem',  { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg':  ['2rem',     { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '600' }],
        'display-md':  ['1.5rem',   { lineHeight: '1.2',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-sm':  ['1.25rem',  { lineHeight: '1.3',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'title':       ['1.125rem', { lineHeight: '1.35', fontWeight: '700' }],
        'body-lg':     ['1.125rem', { lineHeight: '1.6' }],
        'body-md':     ['1rem',     { lineHeight: '1.6' }],
        'body-sm':     ['0.875rem', { lineHeight: '1.5' }],
        'label':       ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.04em', fontWeight: '500' }],
        'caption':     ['0.75rem',  { lineHeight: '1.4' }],
        'price':       ['1.25rem',  { lineHeight: '1.3', fontWeight: '600' }],
      },

      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
        '128': '32rem',
        '144': '36rem',
      },

      borderRadius: {
        // Hierarchy, not one bubble radius on everything.
        'sm': '0.5rem',    // 8px  — inputs, chips
        DEFAULT: '0.625rem',
        'md': '0.875rem',  // 14px — cards
        'lg': '1.25rem',   // 20px — feature panels
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem',
        'pill': '9999px',
      },

      boxShadow: {
        'sm': '0 1px 2px rgba(26,25,24,.06)',
        'card': '0 1px 2px rgba(26,25,24,.06)',
        'md': '0 4px 16px -4px rgba(26,25,24,.10)',
        'card-hover': '0 8px 24px -8px rgba(26,25,24,.14)',
        'elevated': '0 12px 32px -8px rgba(26,25,24,.14)',
        'lg': '0 14px 40px -12px rgba(26,25,24,.16)',
        'modal': '0 24px 64px -16px rgba(26,25,24,.22)',
        'nav': '0 1px 0 0 rgba(26,25,24,.06)',
      },

      animation: {
        'fade-in': 'fadeIn 0.28s cubic-bezier(0.2,0.7,0.2,1) forwards',
        'fade-up': 'fadeUp 0.32s cubic-bezier(0.2,0.7,0.2,1) forwards',
        'slide-in-right': 'slideInRight 0.24s cubic-bezier(0.2,0.7,0.2,1) forwards',
        'slide-in-left': 'slideInLeft 0.24s cubic-bezier(0.2,0.7,0.2,1) forwards',
        'slide-up': 'slideUp 0.32s cubic-bezier(0.2,0.7,0.2,1) forwards',
        'scale-in': 'scaleIn 0.18s cubic-bezier(0.2,0.7,0.2,1) forwards',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite',
      },

      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-fox': 'linear-gradient(135deg, #FF4D00 0%, #FF7642 100%)',
        'gradient-warm': 'linear-gradient(180deg, #FAF8F5 0%, #F5F3EF 100%)',
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E\")",
      },

      transitionTimingFunction: {
        'enter': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        'exit': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      },

      transitionDuration: {
        'micro': '80ms',
        'short': '180ms',
        'medium': '280ms',
        'long': '360ms',
      },

      screens: { 'xs': '475px' },
      maxWidth: { '7xl': '80rem', '8xl': '85rem' },
    },
  },

  plugins: [],
};
