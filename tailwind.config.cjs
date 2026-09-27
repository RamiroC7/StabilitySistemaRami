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
        "text-secondary": "#475569",
        "text-muted": "#475569",
        "border-color": "#dae0e7",
        success: "#10b981",

        // Additional colors from new design
        "card-light": "#FFFFFF",
        "card-dark": "#1E293B",
        "input-light": "#FFFFFF",
        "input-dark": "#334155",
        "border-light": "#E2E8F0",
        "border-dark": "#475569",
        "text-light": "#1e293b",
        "text-dark": "#f8fafc",
        "muted-light": "#475569",
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
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      keyframes: {
        // Recorre un círculo chico (radio 6px) a velocidad angular
        // constante — timing "linear" en la animación, no ease-in-out,
        // para que se sienta como un giro parejo y no un rebote.
        "gentle-circle": {
          "0%": { transform: "translate(6px, 0px)" },
          "12.5%": { transform: "translate(4.2px, 4.2px)" },
          "25%": { transform: "translate(0px, 6px)" },
          "37.5%": { transform: "translate(-4.2px, 4.2px)" },
          "50%": { transform: "translate(-6px, 0px)" },
          "62.5%": { transform: "translate(-4.2px, -4.2px)" },
          "75%": { transform: "translate(0px, -6px)" },
          "87.5%": { transform: "translate(4.2px, -4.2px)" },
          "100%": { transform: "translate(6px, 0px)" },
        },
      },
      animation: {
        "gentle-circle": "gentle-circle 3s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
