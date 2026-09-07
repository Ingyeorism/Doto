import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PreviewApp from "./PreviewApp";
import "./styles.css";
import { startDiagnostics } from "./diagnostics";

if (
  !new URLSearchParams(location.search).has("simulation") &&
  new URLSearchParams(location.search).get("preview") !== "1"
)
  startDiagnostics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has("simulation") ||
    new URLSearchParams(location.search).get("preview") === "1" ? (
      <PreviewApp />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
