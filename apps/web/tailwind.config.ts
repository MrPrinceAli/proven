import type { Config } from "tailwindcss";
import { tailwindPreset } from "@proven/ui/tokens";

const config: Config = {
  presets: [tailwindPreset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  plugins: [],
};

export default config;
