import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        orbital: {
          primary: '#1D4ED8',
          accent:  '#0EA5E9',
          bg:      '#0F172A',
          surface: '#1E293B',
        },
      },
    },
  },
  plugins: [],
};

export default config;
