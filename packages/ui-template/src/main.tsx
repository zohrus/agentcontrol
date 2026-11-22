import { createClient } from "@agentcontrol/sdk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

// The one client of the UI: same origin as the page, since the app serves both.
const client = createClient({ baseUrl: "" });

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App client={client} />
    </StrictMode>,
  );
}
