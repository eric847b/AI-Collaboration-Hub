import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installTelemetry } from "./lib/telemetry";
import "./index.css";

// Runtime error-telemetry: local ring buffer + localStorage; POSTs batches only
// when window.TELEMETRY_ENDPOINT is set. Must never block app boot.
try {
  installTelemetry({ appId: "nexus-infinity-hub", version: "1.0.0" });
} catch {
  /* telemetry is best-effort */
}

createRoot(document.getElementById("root")!).render(<App />);
