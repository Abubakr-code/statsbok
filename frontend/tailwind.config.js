/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Colors map to CSS variables so the same utility classes
        // (bg-ink, text-parchment, ...) work in both dark and light themes.
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)'
        },
        parchment: {
          DEFAULT: 'rgb(var(--parchment) / <alpha-value>)',
          dim: 'rgb(var(--parchment-dim) / <alpha-value>)',
          faint: 'rgb(var(--parchment-faint) / <alpha-value>)'
        },
        amber: {
          DEFAULT: 'rgb(var(--amber) / <alpha-value>)',
          600: 'rgb(var(--amber-600) / <alpha-value>)',
          300: 'rgb(var(--amber-300) / <alpha-value>)'
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Source Serif 4"', '"Source Serif Pro"', 'Georgia', 'serif']
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite'
      }
    }
  },
  plugins: []
};
