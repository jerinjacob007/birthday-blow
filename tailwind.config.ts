import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        buttercream: "#FFF3D8",
        frosting: "#F9A8D4",
        berry: "#BE123C",
        candle: "#F97316",
        blueberry: "#2563EB",
        cocoa: "#3B241C",
      },
      boxShadow: {
        clay: "0 26px 60px rgba(190, 18, 60, 0.22), inset 0 3px 0 rgba(255,255,255,0.45)",
        glow: "0 0 36px rgba(249, 115, 22, 0.55)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-rounded", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
