/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paid: { DEFAULT: "#16a34a", light: "#dcfce7" },
        pending: { DEFAULT: "#d97706", light: "#fef3c7" },
        overdue: { DEFAULT: "#dc2626", light: "#fee2e2" },
      },
    },
  },
  plugins: [],
};
