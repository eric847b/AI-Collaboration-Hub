import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installTelemetry } from "./lib/telemetry";
import "./index.css";

// Runtime error-telemetry: local ring buffer + localStorage; POSTs batches only
// when window.TELEMETRY_ENDPOINT is set. Must never block app boot.
try {
  installTelemetry({ appId: "self-evolve-dash", version: "1.0.0" });
} catch {
  /* telemetry is best-effort */
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
