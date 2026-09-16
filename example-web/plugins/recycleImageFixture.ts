import type { Plugin } from "vite";

// Local, uncached images make request-order checks repeatable without a third-party service.
export function recycleImageFixture(): Plugin {
    return {
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const url = new URL(request.url ?? "/", "http://localhost");
                if (url.pathname !== "/__fixtures/recycle-image") return next();
                const index = Number(url.searchParams.get("index")) || 0;
                response.setHeader("Content-Type", "image/svg+xml");
                response.setHeader("Cache-Control", "no-store");
                setTimeout(() => {
                    response.end(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="92"><rect width="140" height="92" fill="hsl(${(index * 47) % 360},60%,40%)"/><text x="70" y="54" text-anchor="middle" fill="white" font-size="24">${index}</text></svg>`,
                    );
                }, 400);
            });
        },
        name: "recycle-image-fixture",
    };
}
