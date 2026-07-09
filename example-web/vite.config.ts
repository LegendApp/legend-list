/** biome-ignore-all assist/source/useSortedKeys: alias order is important  */
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig(({ command, mode }) => {
    const useHttps = command === "serve" && mode === "https";

    return {
        define: {
            __DEV__: JSON.stringify(true),
            global: "globalThis",
        },
        plugins: [
            react(),
            tailwindcss(),
            ...(useHttps
                ? [
                      mkcert({
                          hosts: ["localhost", "127.0.0.1"],
                      }),
                  ]
                : []),
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "../src"),
                "@examples": path.resolve(__dirname, "../examples-shared"),
                "@legendapp/list/react": path.resolve(__dirname, "../src/react.ts"),
            },
            // Deduplicate React to avoid multiple copies
            dedupe: ["react", "react-dom"],
            // Use .tsx first so web platform files are preferred over .native.tsx
            extensions: [".tsx", ".ts", ".jsx", ".js"],
        },
    };
});
