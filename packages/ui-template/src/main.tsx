import { createClient } from "@agentcontrol/sdk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { reloadOnceWhenUnauthorized } from "./data/index.ts";
import "./styles.css";

// The one client of the UI: same origin as the page, since the app serves both. It sends the secret
// the app put into this page; if the app restarted and made a new one, reload once to get it.
const client = createClient({ baseUrl: "", onUnauthorized: reloadOnceWhenUnauthorized });

// StrictMode renders everything twice to find mistakes: useful while developing, a cost in the
// built UI that users run (Vite replaces `import.meta.env.DEV` by false there).
const app = <App client={client} />;
const root = document.getElementById("root");
if (root) createRoot(root).render(import.meta.env.DEV ? <StrictMode>{app}</StrictMode> : app);
