import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
    define: {
        __DEV__: JSON.stringify(true),
        global: "globalThis",
    },
    optimizeDeps: {
        exclude: ["react-native"],
    },
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "../src"),
        },
        // Use .tsx first so web platform files are preferred over .native.tsx
        extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
});
