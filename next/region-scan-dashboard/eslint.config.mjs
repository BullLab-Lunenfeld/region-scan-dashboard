import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: compat.extends(
      "next/core-web-vitals",
      "plugin:react/recommended",
      "plugin:@typescript-eslint/recommended",
      "prettier"
    ),

    plugins: {
      "@typescript-eslint": typescriptEslint,
      react,
    },

    rules: {
      "no-console": [
        "warn",
        {
          allow: ["error"],
        },
      ],

      "no-case-declarations": "off",
      "no-debugger": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-explicit-any": "off",

      "import/order": [
        "error",
        {
          pathGroups: [
            {
              pattern: "next/dynamic",
              group: "builtin",
              position: "before",
            },
            {
              pattern: "react",
              group: "builtin",
              position: "before",
            },
          ],

          pathGroupsExcludedImportTypes: ["react"],
        },
      ],

      "import/no-useless-path-segments": "error",
    },
  },
]);
