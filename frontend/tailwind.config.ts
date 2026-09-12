import type { Config } from "tailwindcss";

/**
 * Tailwind v4 is CSS-first (see `@theme` in app/globals.css); this file is kept
 * alongside it — and loaded via `@config` — purely to extend the theme with
 * the AI Paper Click (APC) brand palette in one typed, IDE-discoverable place.
 *
 * Editorial redesign (2026): `apc-*` is repointed from the old soft navy
 * scale to a black-based scale — every existing `bg-apc-900` / `text-apc-900`
 * / `focus:ring-apc-accent` usage across the app picks up the new
 * high-contrast look for free, without touching each call site. `brand-*`
 * are the new named tokens for the yellow accent, the hard border color, and
 * the off-white canvas, exactly as specced.
 */
const config: Config = {
  theme: {
    extend: {
      colors: {
        apc: {
          // Solid black — primary buttons, active states, headers.
          950: "#000000",
          900: "#000000",
          800: "#171717", // neutral-900, for hover states over solid black
          700: "#262626",
          600: "#404040",
          accent: "#FACC15", // brand-yellow, reused so existing focus rings/accents pick it up
        },
        brand: {
          yellow: "#FACC15",
          border: "#000000",
          canvas: "#F8F9FA",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Sharp offset "retro" shadows — no soft/blurred shadows anywhere.
        card: "2px 2px 0px 0px rgba(0,0,0,1)",
        popover: "4px 4px 0px 0px rgba(0,0,0,1)",
        hard: "4px 4px 0px 0px rgba(0,0,0,1)",
        "hard-sm": "2px 2px 0px 0px rgba(0,0,0,1)",
      },
      borderRadius: {
        xl2: "0px", // was 1rem — boxy, no large rounding anywhere it's used
      },
    },
  },
};

export default config;
