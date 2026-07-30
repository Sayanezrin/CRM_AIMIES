import React from "react";
import { createRoot } from "react-dom/client";
import "./App.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The app remains usable when service workers are unavailable.
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations?.().then(async (registrations) => {
      if (!registrations.length) {
        window.sessionStorage.removeItem("aimies.dev.swReloaded");
        return;
      }

      await Promise.all(registrations.map((registration) => registration.unregister()));
      if (!window.sessionStorage.getItem("aimies.dev.swReloaded")) {
        window.sessionStorage.setItem("aimies.dev.swReloaded", "true");
        window.location.reload();
      }
    }).catch(() => {
      // Local development should continue even if cleanup is blocked.
    });
  }
}
