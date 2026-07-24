import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MetroApp from "../app/MetroApp";
import "../app/styles/design-system.css";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MetroApp />
  </StrictMode>,
);
