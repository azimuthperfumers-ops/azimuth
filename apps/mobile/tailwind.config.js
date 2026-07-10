/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Mirrors constants/theme.ts — the source of truth for screens, which
        // mostly hardcode these as hex literals rather than Tailwind tokens.
        background: "#F5F0E7",
        surface: "#FAF6EE",
        ink: "#1B1611",
        "ink-muted": "#57493A",
        border: "#E3DDD1",
        accent: "#9A5B2B",
      },
    },
  },
  plugins: [],
};
