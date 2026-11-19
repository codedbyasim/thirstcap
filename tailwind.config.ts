import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC",
        surface: "#FFFFFF",
        subtle: "#F1F5F9",
        line: "#E2E8F0",
        marine: {
          deep: "#04111D",
          DEFAULT: "#081B2E",
          panel: "#0A1E33",
          card: "#102842",
          soft: "#1E3A5F",
          ink: "#0B1726",
          muted: "#475569",
          faint: "#64748B",
        },
        hydro: {
          DEFAULT: "#0369A1",
          bright: "#0EA5E9",
          dark: "#075985",
          tint: "#E0F2FE",
          teal: "#047857",
          emerald: "#047857",
          emeraldbright: "#10B981",
          emeraldtint: "#D1FAE5",
          tealtint: "#D1FAE5",
        },
        heat: {
          DEFAULT: "#C2410C",
          bright: "#EA580C",
          tint: "#FFEDD5",
        },
        swap: {
          DEFAULT: "#B45309",
          tint: "#FEF3C7",
        },
        flex: {
          DEFAULT: "#E11D48",
          tint: "#FFE4E6",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
