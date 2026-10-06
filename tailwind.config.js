/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yerba: {
          verde: '#0f4b25',
          'verde-dark': '#0a341a',
          'verde-light': '#186d38',
          'verde-subtle': '#eaf4ee',
          crema: '#ece7d7',
          'crema-light': '#f8f6f0',
          'crema-dark': '#ded6c1',
          naranja: '#e68628',
          'naranja-hover': '#cc721b',
          'naranja-light': '#fdf2e8',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
