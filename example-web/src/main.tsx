import React from "react";
import ReactDOM from "react-dom/client";

import { startLayoutMonitor } from "@examples/layoutInvariants";
import App from "./App.tsx";
import "./index.css";

// Dev-only frame-by-frame layout checks for fixture drivers: open with ?layoutCheck or set
// window.__LL_LAYOUT_CHECK__ before load; drivers read window.__llLayoutMonitor.
const layoutCheckWindow = window as typeof window & { __LL_LAYOUT_CHECK__?: boolean; __llLayoutMonitor?: unknown };
if (layoutCheckWindow.__LL_LAYOUT_CHECK__ || new URLSearchParams(location.search).has("layoutCheck")) {
    layoutCheckWindow.__llLayoutMonitor = startLayoutMonitor();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
