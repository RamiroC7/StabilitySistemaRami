/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand colors from UI designs
        primary: "#0056b3",
        "primary-hover": "#004494",
        "brand-blue": "#1a1a5e",
        "background-light": "#f8f9fa",
        "background-dark": "#0f1923",
        "surface-light": "#F3F4F6",
        "surface-dark": "#1e293b",
        "text-main": "#101418",
        "text-secondary": "#5e758d",
        "text-muted": "#5e758d",
        "border-color": "#dae0e7",
        success: "#10b981",

        // Additional colors from new design
        secondary: "#1a202c",
        "card-light": "#FFFFFF",
        "card-dark": "#1E293B",
        "input-light": "#FFFFFF",
        "input-dark": "#334155",
        "border-light": "#E2E8F0",
        "border-dark": "#475569",
        "text-light": "#1e293b",
        "text-dark": "#f8fafc",
        "muted-light": "#64748b",
        "muted-dark": "#94a3b8",

        // shadcn semantic colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        display: ["Lexend", "Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        serif: ["Playfair Display", "serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
