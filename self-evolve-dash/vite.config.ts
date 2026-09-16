import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  // Optional dev-only tagger — never block production builds if missing/broken.
  const plugins: ReturnType<typeof react>[] = [react()];
  if (isDev) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { componentTagger } = require("lovable-tagger") as {
        componentTagger: () => unknown;
      };
      plugins.push(componentTagger() as ReturnType<typeof react>);
    } catch {
      // ignore
    }
  }

  return {
    server: {
      host: true,
      port: 8080,
      strictPort: true,
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      sourcemap: isDev ? "inline" : false,
      target: "esnext",
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
  };
});
