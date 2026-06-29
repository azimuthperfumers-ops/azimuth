/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Azimuth brand palette
        brand: {
          black: "#111111",
          gold: "#c9a96e",
          cream: "#f9f7f4",
          muted: "#888888",
        },
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
