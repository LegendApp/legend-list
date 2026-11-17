// Start `bun run dev:fixtures --port 5188` in example-web first.
// Run with Node and Playwright installed, or set PLAYWRIGHT_MODULE to its entrypoint.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const results = [];
    // Below 1 the next ResizeObserver delivery corrects the first read; above 1 the shrink
    // confirmation re-reads the transformed size, so the row would keep it.
    for (const scale of [0.5, 1.5]) {
        await page.goto(`${process.env.FIXTURE_URL || "http://127.0.0.1:5188"}/scaled-container?scale=${scale}`);
        await page.locator("[data-row='0']").waitFor();
    // Layout-space gaps between consecutive rendered rows; every row is 50 layout px tall.
    const gaps = () =>
        page.evaluate(() =>
            Array.from(document.querySelectorAll("[data-row]"))
                .map((row) => ({ id: Number(row.dataset.row), top: row.parentElement.offsetTop }))
                .sort((a, b) => a.id - b.id)
                .flatMap((row, i, rows) => (i > 0 && rows[i - 1].id === row.id - 1 ? [row.top - rows[i - 1].top] : [])),
        );
    const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        // Scrolling reassigns containers to rows of the same layout size, so ResizeObserver stays quiet.
        for (const top of [0, 1500, 3000, 6000]) {
            await page.evaluate((y) => {
                let scroller = document.querySelector("[data-row]");
                while (!/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
                scroller.scrollTop = y;
            }, top);
            await settle();
            await settle();
            const bad = (await gaps()).filter((gap) => Math.abs(gap - 50) > 0.5);
            results.push({ bad, scale, top });
        }
    }
    console.log(JSON.stringify(results));
    for (const { bad, scale, top } of results) assert.deepEqual(bad, [], `row gaps at scale ${scale}, scrollTop ${top}`);
    assert.deepEqual(errors, []);
    console.log("Scaled container: rows keep their layout size under an ancestor scale transform.");
} finally {
    await browser.close();
}
