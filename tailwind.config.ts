import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f7f7f8',
          100: '#eeeef0',
          200: '#d8d8de',
          300: '#b4b4be',
          400: '#86868f',
          500: '#5c5c66',
          600: '#3f3f48',
          700: '#2a2a32',
          800: '#1a1a20',
          900: '#0e0e13',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
