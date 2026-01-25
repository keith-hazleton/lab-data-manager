/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS severity colors
        'css-normal': '#22c55e',
        'css-mild': '#eab308',
        'css-moderate': '#f97316',
        'css-severe': '#ef4444',
        'css-critical': '#991b1b',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
