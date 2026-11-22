import eslintComments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

const files = ["{packages,e2e,spike,scripts}/**/*.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/.e2e-tmp/**", ".claude/**"],
  },
  {
    files,
    extends: [tseslint.configs.strictTypeChecked, eslintComments.recommended],
    plugins: { sonarjs },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      complexity: ["error", 5],
      "sonarjs/cognitive-complexity": ["error", 8],
      "max-depth": ["error", 2],
      "max-params": ["error", 3],
      "max-statements": ["error", 12],
      "max-lines-per-function": ["error", { max: 30, skipBlankLines: false, skipComments: false }],
      "max-lines": ["error", { max: 200, skipBlankLines: false, skipComments: false }],
      "max-nested-callbacks": ["error", 2],
      "no-nested-ternary": "error",
      "@eslint-community/eslint-comments/require-description": "error",
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@eslint-community/eslint-comments/no-unused-disable": "error",
    },
  },
);
