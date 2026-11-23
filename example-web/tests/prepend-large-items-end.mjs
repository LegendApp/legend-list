// Start `bun run dev:fixtures --port 5188` in example-web first.
// Run with Node and Playwright installed, or set PLAYWRIGHT_MODULE to its entrypoint.
import assert from "node:assert/strict";

const fixtureUrl = process.env.FIXTURE_URL || "http://127.0.0.1:5188";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${fixtureUrl}/prepend-large-items-jump`);
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
    console.log("Prepend fixture: both presets reach the physical end after pagination.");

    await page.goto(`${fixtureUrl}/mvcp-test`);
    const list = page.locator(".mvcp-test-list");
    await page.waitForFunction(() => document.querySelector(".mvcp-test-list")?.scrollTop > 100);
    await list.evaluate((element) => {
        element.scrollTop = 50;
    });
    await page.getByText(/item #0 height:/).waitFor({ state: "visible" });
    const before = await list.evaluate((element) => element.scrollTop);
    assert.equal(before, 50);
    await page.getByRole("button", { name: "Prepend row" }).click();
    try {
        await page.waitForFunction(() => document.querySelector(".mvcp-test-list")?.scrollTop === 0, undefined, { timeout: 3000 });
    } finally {
        console.log("Prepend at threshold: offset before", before, "offset after", await list.evaluate((element) => element.scrollTop));
    }
    await page.getByText(/item #-1 height:/).waitFor({ state: "visible" });
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
}
