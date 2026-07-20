import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    server: {
      host: true, // resolves IPv6 "::" issues on some networks
      port: 8080,
      strictPort: true // prevents silent port switching
    },

    plugins: [
      react(),
      isDev && componentTagger()
    ].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src")
      }
    },

    build: {
      sourcemap: isDev ? "inline" : false,
      target: "esnext"
    },

    optimizeDeps: {
      include: ["react", "react-dom"]
    }
  };
});
