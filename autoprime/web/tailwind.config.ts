import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          50: '#f7f8fa',
          100: '#eef0f3',
          950: '#0a0b0d',
          900: '#111318',
          800: '#181b22',
          700: '#22262f',
          600: '#2e333f',
          500: '#464d5c',
        },
        primary: {
          50: '#eef5ff',
          100: '#d9eaff',
          400: '#4f9bff',
          500: '#2f7cf6',
          600: '#1f63d6',
          700: '#194ea8',
        },
        success: '#2fbf71',
        warning: '#f5a623',
        danger: '#f0475a',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
