/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],

  theme: {
    extend: {
      colors: {
        fox: {
          50: '#FFF5F0',
          100: '#FFE8DB',
          200: '#FFD0B5',
          300: '#FFB088',
          400: '#FF8C55',
          500: '#FF4D00',
          600: '#E04400',
          700: '#B83800',
          800: '#8C2B00',
          900: '#661F00',
        },
        warm: {
          white: '#FAFAF8',
          50: '#F7F6F3',
          100: '#EEEDEA',
          200: '#E0DFDB',
          300: '#C8C7C2',
          400: '#A3A29D',
          500: '#7A7974',
          600: '#5C5B57',
          700: '#434240',
          800: '#2D2C2B',
          900: '#1A1918',
        },
        success: {
          50: '#EAF3DE',
          500: '#639922',
          700: '#27500A',
        },
        warning: {
          50: '#FAEEDA',
          500: '#EF9F27',
          700: '#633806',
        },
        danger: {
          50: '#FCEBEB',
          500: '#E24B4A',
          700: '#791F1F',
        },
        info: {
          50: '#E6F1FB',
          500: '#378ADD',
          700: '#0C447C',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['2.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-sm': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.7' }],
        'body-md': ['1rem', { lineHeight: '1.7' }],
        'body-sm': ['0.875rem', { lineHeight: '1.6' }],
        'caption': ['0.75rem', { lineHeight: '1.5' }],
        'price': ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
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
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },

      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'elevated': '0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 8px -4px rgba(0, 0, 0, 0.04)',
        'modal': '0 20px 60px -12px rgba(0, 0, 0, 0.15), 0 8px 20px -8px rgba(0, 0, 0, 0.1)',
        'nav': '0 1px 0 0 rgba(0, 0, 0, 0.05)',
        'inner-glow': 'inset 0 1px 2px 0 rgba(255, 77, 0, 0.06)',
      },

      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-fox': 'linear-gradient(135deg, #FF4D00 0%, #FF8C55 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1A1918 0%, #2D2C2B 100%)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      screens: {
        'xs': '475px',
      },

      maxWidth: {
        '8xl': '88rem',
      },
    },
  },

  plugins: [],
};
