// Start `bun run dev:fixtures --port 5188` in example-web first.
// Run with Node and Playwright installed, or set PLAYWRIGHT_MODULE to its entrypoint.
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${process.env.FIXTURE_URL || "http://127.0.0.1:5188"}/mutable-cells`);
    const row = page.getByText("Item 0", { exact: true }).locator("../..");
    const initialHeight = (await row.boundingBox()).height;
    await row.getByRole("button", { name: "Expand", exact: true }).click();
    await row.getByText("Extra content for item 0.", { exact: false }).waitFor();
    assert.ok((await row.boundingBox()).height > initialHeight);
    await row.getByRole("button", { name: "Collapse", exact: true }).click();
    await row.getByText("Extra content for item 0.", { exact: false }).waitFor({ state: "hidden" });
    assert.equal((await row.boundingBox()).height, initialHeight);
    assert.deepEqual(errors, []);
    console.log("Mutable cells: expanding and collapsing updates row content and measured height.");
} finally {
    await browser.close();
}
