import { defineConfig } from "@playwright/test";

export default defineConfig({
    forbidOnly: !!process.env.CI,
    fullyParallel: false,
    projects: [
        { name: "chromium", use: { browserName: "chromium" } },
        { name: "webkit", use: { browserName: "webkit" } },
    ],
    retries: 0,
    testDir: "./e2e",
    testMatch: "**/*.e2e.ts",
    use: {
        baseURL: "http://127.0.0.1:5197",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "bun run dev:fixtures --host 127.0.0.1 --port 5197 --strictPort",
        reuseExistingServer: false,
        url: "http://127.0.0.1:5197/masonry",
    },
    workers: 1,
});
