// Flat config. Type-aware rules are enabled for src/, which is where the app
// lives; config files at the root are linted with the untyped recommended set
// so they do not need to sit inside a tsconfig project.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src-tauri/target", "node_modules"] },

  // Application code.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, __APP_VERSION__: "readonly" },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Off on purpose. It only affects how granular Vite's hot reload is in
      // development, never correctness, and three files legitimately export a
      // component next to a shared style constant (Empty.tsx, Toast.tsx). To
      // turn it back on, move those constants into src/lib/styles.ts, which
      // already exists for exactly that.
      "react-refresh/only-export-components": "off",

      // `any` defeats the point of the domain types in src/lib/types.ts.
      "@typescript-eslint/no-explicit-any": "error",

      // A rejected promise that nobody handles is how a failed backend call
      // disappears silently — see #8.
      "@typescript-eslint/no-floating-promises": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Type-aware linting needs the TS program; only src/ is in tsconfig.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { project: ["./tsconfig.json"], tsconfigRootDir: import.meta.dirname },
    },
  },

  // Vite/vitest/eslint config files run in Node and live outside the TS
  // project, so they get the untyped recommended set — but still the TS parser,
  // since vite.config.ts is TypeScript.
  {
    files: ["*.{js,ts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
