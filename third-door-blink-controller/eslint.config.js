// Flat config for ESLint 9+/10 (expo lint requires eslint.config.*)
import expoConfig from "eslint-config-expo/flat.js";

export default [
  ...expoConfig,
  {
    ignores: [".expo/**", "dist/**", "web-build/**", "node_modules/**"],
  },
];
