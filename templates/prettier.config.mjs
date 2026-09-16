// packages/config/prettier.config.mjs
// Install: pnpm add -D -w prettier prettier-plugin-tailwindcss prettier-plugin-astro
/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  singleQuote: false,
  semi: true,
  trailingComma: "all",
  plugins: ["prettier-plugin-tailwindcss", "prettier-plugin-astro"],
  tailwindFunctions: ["cn", "cva", "clsx"],
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
};
