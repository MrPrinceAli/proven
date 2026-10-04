/**
 * "Ledger & Seal" design tokens (D-012): professional-network layout, green theme.
 * Text/background pairs below meet WCAG 2.2 AA contrast (≥ 4.5:1).
 */
export const colors = {
  brand: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    200: "#A7F3D0",
    600: "#059669",
    700: "#047857", // primary
    800: "#065F46", // primary hover
    900: "#064E3B",
  },
  canvas: "#F4F2EE", // page background (warm grey)
  surface: "#FFFFFF",
  line: "#E5E7EB",
  ink: "#1F2937",
  muted: "#4B5563",
} as const;

/** Tailwind preset shared by apps/web. */
export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        canvas: colors.canvas,
        surface: colors.surface,
        line: colors.line,
        ink: colors.ink,
        muted: colors.muted,
      },
      boxShadow: {
        card: "0 0 0 1px rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.06)",
      },
    },
  },
};
