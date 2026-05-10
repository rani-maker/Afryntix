import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT: "#00E2B1",
          50: "#E8FBF5",
          100: "#B8F5E3",
          200: "#5EEBCA",
          300: "#1BDFAE",
          400: "#00E2B1",
          500: "#00E2B1",
          600: "#00C79A",
          700: "#00A481",
          800: "#076A55",
          900: "#075345",
        },
        mint: {
          DEFAULT: "var(--afx-mint)",
          pale: "var(--afx-mint-pale)",
          soft: "var(--afx-mint-soft)",
          2: "var(--afx-mint-2)",
          3: "rgb(var(--afx-mint-3-rgb) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--afx-ink-rgb) / <alpha-value>)",
          2: "var(--afx-ink-2)",
          3: "var(--afx-ink-3)",
          4: "var(--afx-ink-4)",
          5: "var(--afx-ink-5)",
        },
        night: {
          DEFAULT: "rgb(var(--afx-night-rgb) / <alpha-value>)",
          2: "var(--afx-night-2)",
          soft: "var(--afx-night-soft)",
        },
        surface: {
          DEFAULT: "rgb(var(--afx-surface-rgb) / <alpha-value>)",
          2: "rgb(var(--afx-bg-2-rgb) / <alpha-value>)",
          3: "var(--afx-bg-3)",
        },
        line: {
          DEFAULT: "var(--afx-line)",
          2: "var(--afx-line-2)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans-brand)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-sans-brand)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono-brand)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        "brand-sm": "0 1px 2px rgba(5,25,21,0.06), 0 1px 1px rgba(5,25,21,0.04)",
        "brand-md": "0 4px 12px rgba(5,25,21,0.08), 0 2px 4px rgba(5,25,21,0.04)",
        "brand-lg": "0 16px 48px rgba(5,25,21,0.22), 0 4px 12px rgba(5,25,21,0.10)",
        "glow-mint": "0 0 0 4px rgba(0,226,177,0.18)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
