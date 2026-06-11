/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['DM Sans', 'sans-serif'] },
      colors: {
        primary: { DEFAULT: '#2563eb', dark: '#1d4ed8', light: '#eff6ff' },
        sidebar: '#0f1923',
      },
      borderRadius: { xl: '14px', lg: '10px' },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    }
  },
  plugins: []
}
