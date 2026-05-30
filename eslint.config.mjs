import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Never lint generated, vendored, or non-app code. Without this `eslint .`
  // walks .next/ and reports tens of thousands of phantom errors.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      // Supabase Edge Functions run on Deno with different globals/imports and
      // are linted/typed separately from the Next.js app.
      "supabase/functions/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Project rule levels. These mirror the intent of the old .eslintrc.json
    // (which ESLint 9 no longer reads) and keep stylistic findings as warnings
    // so they surface without breaking the CI build gate.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      // Pre-existing, cosmetic. Kept visible as warnings rather than blocking CI.
      // no-html-link-for-pages flags <a> to internal routes (full reload vs <Link>);
      // worth migrating to next/link over time but not a launch blocker.
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

export default eslintConfig;
