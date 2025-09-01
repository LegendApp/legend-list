import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
    define: {
        __DEV__: JSON.stringify(true),
        global: "globalThis",
    },
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "../src"),
            "@legendapp/list": path.resolve(__dirname, "../src/index.ts"),
        },
        // Use .tsx first so web platform files are preferred over .native.tsx
        extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
});
