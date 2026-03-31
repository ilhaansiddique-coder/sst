import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101826",
        mist: "#f4f6f8",
        coral: "#ff7a59",
        teal: "#0f766e",
        sand: "#f7efe5",
      },
      boxShadow: {
        panel: "0 24px 60px rgba(16, 24, 38, 0.08)",
      },
      fontFamily: {
        sans: ["Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
