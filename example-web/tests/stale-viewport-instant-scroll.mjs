// Start `bun run dev:fixtures --port 5188` in example-web first.
// Run with Node and Playwright installed, or set PLAYWRIGHT_MODULE to its entrypoint.
// PLAYWRIGHT_CHANNEL=chromium uses Playwright's bundled Chromium instead of installed Chrome.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${process.env.FIXTURE_URL || "http://127.0.0.1:5188"}/stale-viewport-instant-scroll`);

    const rerun = async (testId) => {
        await page.getByTestId(testId).click();
        await page.waitForSelector("[data-testid=verdict]:not([data-ok])");
    };
    const readVerdict = async () => {
        const verdict = page.getByTestId("verdict");
        await page.waitForSelector("[data-testid=verdict][data-ok]");
        return { ok: await verdict.getAttribute("data-ok"), text: await verdict.textContent() };
    };

    // An instant scroll the DOM clamps without a scroll event must not leave state.scroll past the DOM.
    for (let run = 0; run < 3; run++) {
        if (run > 0) await rerun("run-instant");
        const { ok, text } = await readVerdict();
        assert.deepEqual(errors, []);
        assert.equal(ok, "true", text);
    }
    // Animated scrolls already follow DOM scroll events; keep them as a control.
    await rerun("run-animated");
    const animated = await readVerdict();
    assert.equal(animated.ok, "true", animated.text);

    assert.deepEqual(errors, []);
    console.log("Stale viewport fixture: state.scroll and viewability match the DOM after clamped scrolls.");
} finally {
    await browser.close();
}
