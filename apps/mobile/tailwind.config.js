/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Mirrors constants/theme.ts — the source of truth for screens, which
        // mostly hardcode these as hex literals rather than Tailwind tokens.
        background: "#faf8f5",
        surface: "#ffffff",
        ink: "#111111",
        "ink-muted": "#888888",
        border: "#e8e2da",
        accent: "#c0392b",
      },
    },
  },
  plugins: [],
};
