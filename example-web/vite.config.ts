import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    define: {
        __DEV__: JSON.stringify(true),
        global: "globalThis",
    },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "../src"),
            "@legendapp/list": path.resolve(__dirname, "../src/index.ts"),
        },
        // Deduplicate React to avoid multiple copies
        dedupe: ["react", "react-dom"],
        // Use .tsx first so web platform files are preferred over .native.tsx
        extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
});
