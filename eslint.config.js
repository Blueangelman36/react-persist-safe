import js from "@eslint/js";
import persistSafe from "./src/eslint.js";

// The package lints itself with its own rule, so a write-on-mount can't creep into the
// examples or the hook that exists to prevent it.
export default [
  { ignores: ["node_modules/"] },
  { files: ["**/*.{js,jsx}"], ...js.configs.recommended },
  { files: ["**/*.{js,jsx}"], ...persistSafe.configs.recommended },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        window: "readonly", document: "readonly", localStorage: "readonly", sessionStorage: "readonly",
        globalThis: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly",
        clearInterval: "readonly", AbortController: "readonly", StorageEvent: "readonly", fetch: "readonly",
        console: "readonly", process: "readonly", __APP_VERSION__: "readonly",
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
];
