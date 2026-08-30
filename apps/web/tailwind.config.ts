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
        bg: "#F6F7F9",
        surface: "#FFFFFF",
        ink: "#1A1D23",
        muted: "#5B6472",
        primary: "#2F6BFF",
        success: "#14B877",
        danger: "#E5484D",
        warning: "#F5A524",
        glow: "#6E8BFF",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,29,35,0.04), 0 8px 24px rgba(26,29,35,0.06)",
        glow: "0 0 0 1px rgba(47,107,255,0.18), 0 8px 24px rgba(47,107,255,0.16)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
