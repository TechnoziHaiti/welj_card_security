import type { Config } from "tailwindcss";

// ==============================================================================
// CODES COULEURS PRINCIPALES DU SYSTÈME (Modifier ici pour changer partout)
// ==============================================================================
export const systemThemeColors = {
  50: "#f0fdf4",
  100: "#dcfce7",
  200: "#bbf7d0",
  300: "#86efac",
  400: "#4ade80",
  500: "#22c55e", // Vert vif
  600: "#16a34a", // Vert solide vif principal (boutons, icônes, sélections, navigation active)
  700: "#15803d", // Vert solide vif au survol (hover)
  800: "#166534",
  900: "#14532d",
  950: "#052e16",
};

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', '"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: systemThemeColors,
        primary: systemThemeColors,
        // Redirige également 'blue' vers la couleur principale du système :
        // Permet à tous les éléments existants (bg-blue-*, text-blue-*, border-blue-*, etc.)
        // de changer de couleur instantanément depuis cet unique fichier centralisé !
        blue: systemThemeColors,
      },
    },
  },
  plugins: [],
} satisfies Config;
