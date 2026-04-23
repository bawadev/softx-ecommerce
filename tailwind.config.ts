import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Black scale (replaces Navy) - Pure monochrome theme
        black: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        // Note: Gold and Coral removed for pure monochrome theme
        // Gray scale uses Tailwind's default gray colors
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
        // Heavy condensed display face for hero titles / campaign headers.
        // Matches the compact, tall proportions of the LOCKED wordmark.
        display: ['var(--font-display)', 'Impact', 'Arial Narrow Bold', 'sans-serif'],
        // Humanist grotesque for all page headings / section titles / product names.
        // Bridges Anton display and Inter body. Variable weight (100-900).
        heading: ['var(--font-heading)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      // Unified type scale — see internal-docs or research doc for rationale.
      // Each token bundles font-size + line-height + letter-spacing + font-weight.
      fontSize: {
        // Display (Anton) — hero only
        'display-hero': ['clamp(3.5rem, 9vw, 10rem)', { lineHeight: '0.9', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-lg': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '0.95', letterSpacing: '-0.02em', fontWeight: '400' }],
        // Display-small (Archivo 600) — editorial sub-display / big feature headings
        'display-sm': ['clamp(1.75rem, 4vw, 3rem)', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '600' }],
        // Headings (Archivo)
        'heading-xl': ['clamp(1.75rem, 3.2vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-lg': ['clamp(1.375rem, 2.2vw, 1.75rem)', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        'heading-md': ['clamp(1.125rem, 1.6vw, 1.25rem)', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        'heading-sm': ['clamp(0.875rem, 1.2vw, 1rem)', { lineHeight: '1.25', letterSpacing: '0', fontWeight: '500' }],
        // Uppercase eyebrow / nav / CTA — wide tracking
        'label': ['clamp(0.6875rem, 0.9vw, 0.75rem)', { lineHeight: '1', letterSpacing: '0.12em', fontWeight: '500' }],
        // Body (Inter)
        'body-lg': ['clamp(1rem, 1.3vw, 1.125rem)', { lineHeight: '1.55', letterSpacing: '0', fontWeight: '400' }],
        'body': ['clamp(0.875rem, 1.1vw, 1rem)', { lineHeight: '1.55', letterSpacing: '0', fontWeight: '400' }],
        'body-sm': ['clamp(0.75rem, 0.9vw, 0.8125rem)', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '400' }],
        'caption': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.02em', fontWeight: '500' }],
        // Price — uses heading weight for presence
        'price': ['clamp(0.875rem, 1.1vw, 1rem)', { lineHeight: '1', letterSpacing: '0', fontWeight: '500' }],
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
      },
      maxWidth: {
        '2xl': '1400px',
      },
      animation: {
        'slide-in-right': 'slideInRight 300ms ease-out',
        'slide-in': 'slideIn 300ms ease-out',
        'scale-up': 'scaleUp 300ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-scale': 'pulseScale 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideIn: {
          from: { transform: 'translateY(-1rem)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        scaleUp: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.9)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pulseScale: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.3)' },
        },
        pulseSoft: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgb(243 244 246)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
