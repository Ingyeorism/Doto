import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PreviewApp from "./PreviewApp";
import TabletHostPreview from "./TabletHostPreview";
import "./styles.css";
import { startDiagnostics } from "./diagnostics";
import { ServerAdmin } from "./ServerStatus";

if (
  !new URLSearchParams(location.search).has("simulation") &&
  !["1", "tablet"].includes(
    new URLSearchParams(location.search).get("preview") ?? "",
  )
)
  startDiagnostics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname === "/admin/server" ? (
      <ServerAdmin />
    ) : new URLSearchParams(location.search).get("preview") === "tablet" ? (
      <TabletHostPreview />
    ) : new URLSearchParams(location.search).has("simulation") ||
      new URLSearchParams(location.search).get("preview") === "1" ? (
      <PreviewApp />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
