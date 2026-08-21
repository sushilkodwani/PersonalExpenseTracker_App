/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sush: '#6366f1',
        khush: '#ec4899',
      },
    },
  },
  plugins: [],
}
