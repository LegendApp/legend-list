// Start `bun run dev:fixtures --port 5188` in example-web first.
// Run with Node and Playwright installed, or set PLAYWRIGHT_MODULE to its entrypoint.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${process.env.FIXTURE_URL || "http://127.0.0.1:5188"}/prepend-large-items-jump`);
    for (const preset of ["Small rows", "Oversized rows"]) {
        await page.getByRole("button", { name: preset, exact: true }).click();
        await page.waitForFunction(() => {
            const root = document.querySelector("main");
            return [...root.querySelectorAll("div")].some(
                (element) => getComputedStyle(element).overflowY === "auto" && element.scrollHeight > element.clientHeight,
            );
        });
        // Trigger a prepend before asking the fixture to return to the end.
        await page.evaluate(() => {
            const root = document.querySelector("main");
            const list = [...root.querySelectorAll("div")].find(
                (element) => getComputedStyle(element).overflowY === "auto" && element.scrollHeight > element.clientHeight,
            );
            list.scrollTop = 0;
        });
        await page.waitForTimeout(500);
        await page.getByRole("button", { name: "Scroll to end", exact: true }).click();
        await page.waitForFunction(() => {
            const root = document.querySelector("main");
            const list = [...root.querySelectorAll("div")].find(
                (element) => getComputedStyle(element).overflowY === "auto" && element.scrollHeight > element.clientHeight,
            );
            return list && Math.abs(list.scrollHeight - list.clientHeight - list.scrollTop) <= 2;
        });
    }
    assert.deepEqual(errors, []);
    console.log("Prepend fixture: both presets reach the physical end after pagination.");
} finally {
    await browser.close();
}
