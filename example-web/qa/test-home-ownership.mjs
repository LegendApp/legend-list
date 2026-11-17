import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { test } from "node:test";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
const results = [];
try {
    for (let trial = 0; trial < Number(process.env.HOME_TRIALS || 10); trial++) {
        const page = await browser.newPage({ viewport: { height: 900, width: 1200 } });
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        try {
            await page.goto(`${process.env.HOME_TEST_URL}/qa/home-ownership.html`);
            await page.waitForFunction(() => window.homeOwnership?.list?.getState().scroll > 1000);
            await page.waitForTimeout(300);
            await page.evaluate(async () => {
                await window.homeOwnership.list.scrollToOffset({ animated: false, offset: 14994 });
            });
            await page.waitForTimeout(300);
            await page.evaluate((trial) => {
                const fixture = window.homeOwnership;
                const node = fixture.list.getScrollableNode();
                node.tabIndex = 0;
                node.focus();
                fixture.events = [];
                const record = (kind, value) => fixture.events.push({ at: performance.now(), kind, value });
                const original = node.scrollBy;
                node.scrollBy = function (...args) {
                    record("write", { args, dom: node.scrollTop, scroll: fixture.ctx.state.scroll });
                    return Reflect.apply(original, this, args);
                };
                let arrived = false;
                node.addEventListener("scroll", () => {
                    record("scroll", { offset: node.scrollTop });
                    if (!arrived && node.scrollTop === 0) {
                        arrived = true;
                        requestAnimationFrame(() => {
                            fixture.adjust(9);
                            fixture.resizeFirstRows();
                        });
                    }
                });
                node.addEventListener("scrollend", () => record("scrollend", { offset: node.scrollTop }));
                node.addEventListener("keydown", () => {
                    // Trace timings plus nearby frame boundaries; every trial is retained.
                    const delay = [70, 84.1, 91, 95.9, 98.9, 99, 101.6, 117.6, 121.2, 121.6][trial % 10];
                    setTimeout(() => fixture.adjust(129.25, "item-size"), delay);
                    setTimeout(() => fixture.adjust(-8.633, "item-size"), 161.9);
                }, { once: true });
            }, trial);
            await page.keyboard.press("Home");
            await page.waitForTimeout(1000);
            const result = await page.evaluate(() => {
                const fixture = window.homeOwnership;
                const node = fixture.list.getScrollableNode();
                return {
                    events: fixture.events,
                    offset: node.scrollTop,
                    row0Top: document.querySelector('[data-row="0"]')?.getBoundingClientRect().top,
                    row1Size: fixture.list.getState().sizeAtIndex(1),
                };
            });
            results.push({ ...result, errors, trial });
            await test(`Home keeps row 0 visible through native motion and late measurements, trial ${trial + 1}`, () => {
                assert.deepEqual(errors, []);
                assert.deepEqual(result.events.filter((event) => event.kind === "write"), []);
                assert.equal(result.offset, 0);
                assert.equal(result.row0Top, 16);
                assert.equal(result.row1Size, 209);
                const samples = result.events.filter((event) => event.kind === "scroll");
                const firstZero = samples.findIndex((event) => event.value.offset === 0);
                assert.ok(firstZero >= 0);
                assert.ok(samples.slice(firstZero).every((event) => event.value.offset === 0));
            });
        } finally {
            await page.close();
        }
    }
} finally {
    if (process.env.HOME_OUTPUT) await writeFile(process.env.HOME_OUTPUT, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.map(({ trial, offset, row0Top, row1Size, events }) => ({
        offset,
        row0Top,
        row1Size,
        trial,
        writes: events.filter((event) => event.kind === "write").map((event) => event.value),
    }))));
    await browser.close();
}
