import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#142326",
          soft: "#3d5256",
          faint: "#5e7276",
        },
        lagoon: {
          DEFAULT: "#0e6e68",
          deep: "#083432",
          mist: "#d7efe9",
        },
        sand: {
          DEFAULT: "#f4f1ea",
          card: "#fffcf7",
          line: "#e4ddd0",
        },
        heat: {
          DEFAULT: "#d4652f",
          deep: "#9a3412",
          mist: "#f8e6da",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(20,35,38,0.04), 0 18px 40px -28px rgba(20,35,38,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
