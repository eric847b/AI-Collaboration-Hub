import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(async ({ mode }) => {
  const isDev = mode === "development";
  const plugins: PluginOption[] = [react()];

  if (isDev) {
    try {
      const mod = await import("lovable-tagger");
      if (typeof mod.componentTagger === "function") {
        plugins.push(mod.componentTagger() as PluginOption);
      }
    } catch {
      // optional — must never block production builds
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
