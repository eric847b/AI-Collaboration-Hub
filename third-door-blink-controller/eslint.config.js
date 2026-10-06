// Flat config for ESLint 9+/10 (expo lint requires eslint.config.*)
import expoConfig from "eslint-config-expo/flat.js";

export default [
  ...expoConfig,
  {
    ignores: [".expo/**", "dist/**", "web-build/**", "node_modules/**"],
  },
  {
    // Pin the React version for eslint-plugin-react: its 'detect' mode calls
    // context.getFilename(), an API removed in ESLint 10, crashing every
    // react/* rule at load (7.37.5 is the latest published plugin and still
    // uses the old API). 19.3.0 matches the react pin in package-lock.json;
    // bump this together with react.
    settings: {
      react: {
        version: "19.3.0",
      },
    },
  },
];
