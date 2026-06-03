/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        teal: "#064E3B",
        "teal-btn": "#0f766e",
        accent: "#064E3B",
        "accent-lt": "#ECFDF5",
        ink: "#0F172A",
        ink2: "#334155",
        ink3: "#64748B",
        app: "#F8FAFC",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
