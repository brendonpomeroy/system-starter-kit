// Shared ESLint flat config for the monorepo.
// Lives at packages/config/eslint.config.mjs; each app re-exports it:
//   export { default } from "@PROJECT/config/eslint.config.mjs";
//
// The scaffold skill installs the plugins with pnpm; do not hand-edit package.json.
//   pnpm --filter @PROJECT/config add -D eslint @eslint/js typescript-eslint \
//     eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-plugin-import-x \
//     eslint-config-prettier

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import importX from "eslint-plugin-import-x";
import prettier from "eslint-config-prettier";

/**
 * Design-compliance rules.
 * Forbids arbitrary Tailwind values and raw colour/size literals in component code so
 * every visual decision flows through packages/design-system tokens.
 * See .claude/skills/design-compliance/SKILL.md for the rationale and the allowlist process.
 */
const designCompliance = {
  files: ["apps/**/*.{ts,tsx}", "packages/design-system/src/components/**/*.{ts,tsx}"],
  ignores: ["**/*.test.*", "**/*.stories.*", "packages/design-system/src/tokens/**"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        // Tailwind arbitrary values: text-[#333], p-[13px], w-[47%], bg-[rgb(...)]
        selector: "Literal[value=/\\b[a-z-]+-\\[[^\\]]+\\]/], TemplateElement[value.raw=/\\b[a-z-]+-\\[[^\\]]+\\]/]",
        message: "Arbitrary Tailwind value. Use a design-system token class instead (see docs/style-guide.html).",
      },
      {
        // Raw hex colours anywhere in JSX/TS outside the tokens folder
        selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/], TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
        message: "Raw hex colour. Add it to packages/design-system tokens and reference the token.",
      },
      {
        // rgb()/hsl() colour functions
        selector: "Literal[value=/\\b(rgba?|hsla?)\\(/], TemplateElement[value.raw=/\\b(rgba?|hsla?)\\(/]",
        message: "Raw colour function. Use a design-system token.",
      },
      {
        // Inline style objects with pixel literals: style={{ padding: 13 }} / '13px'
        selector: "JSXAttribute[name.name='style'] ObjectExpression > Property[key.name=/^(padding|margin|gap|width|height|fontSize|borderRadius|top|left|right|bottom)/]",
        message: "Inline layout/size literal. Use a token class or a design-system component prop.",
      },
    ],
  },
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: { "import-x": importX },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "import-x/no-cycle": "error",
      "import-x/order": [
        "warn",
        { groups: ["builtin", "external", "internal", "parent", "sibling", "index"], "newlines-between": "always", alphabetize: { order: "asc" } },
      ],
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Feature-folder boundary: features may not import each other's internals.
    files: ["apps/web/src/features/**", "apps/mobile/src/features/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*", "../*/**"],
              message: "Import from a feature's public index (features/<name>) only. See component-breakdown skill.",
            },
          ],
        },
      ],
    },
  },
  {
    // Raw HTML form controls must come from the design system.
    files: ["apps/web/src/**/*.tsx", "apps/site/src/**/*.{astro,tsx}"],
    ignores: ["packages/design-system/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]",
          message: "Use the design-system component (Button, Input, Select, Textarea) rather than the raw element.",
        },
      ],
    },
  },
  designCompliance,
  prettier,
  {
    ignores: ["**/dist/**", "**/.wrangler/**", "**/.astro/**", "**/.expo/**", "**/node_modules/**", "**/*.config.*"],
  },
);
