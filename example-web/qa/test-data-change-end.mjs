// Appending to, replacing or swapping a followed list's data, a tail row growing, or an optimistic
// send and its ack must keep it at the end, including when the app turns maintainScrollAtEnd off as
// soon as isAtEnd turns false.
// Run with DATA_CHANGE_URL=http://127.0.0.1:PORT (example-web served by Vite).
import assert from "node:assert/strict";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
try {
    for (const gated of [false, true])
    for (const action of ["append", "replace", "swap", "grow", "ack"]) {
        const name = `${gated ? "gated" : "following"} ${action}`;
        const page = await browser.newPage({ viewport: { height: 900, width: 1200 } });
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.goto(`${process.env.DATA_CHANGE_URL}/qa/data-change-end.html${gated ? "?gated" : ""}`);
        await page.waitForFunction(() => window.dataChangeEnd.list?.getState().isAtEnd);
        await page.waitForTimeout(500);
        const frames = await page.evaluate(
            (action) =>
                new Promise((resolve) => {
                    const { list } = window.dataChangeEnd;
                    const node = list.getScrollableNode();
                    const sample = (label) => ({
                        gap: node.scrollHeight - node.clientHeight - node.scrollTop,
                        isAtEnd: list.getState().isAtEnd,
                        label,
                    });
                    const out = [sample("before")];
                    window.dataChangeEnd.mutate(action);
                    out.push(sample("sync"));
                    let frame = 0;
                    const tick = () => {
                        out.push(sample(`f${frame}`));
                        if (++frame < 10) requestAnimationFrame(tick);
                        else setTimeout(() => resolve([...out, sample("settled")]), 500);
                    };
                    requestAnimationFrame(tick);
                }),
            action,
        );
        const settled = frames.at(-1);
        console.log(name, JSON.stringify(frames));
        assert.deepEqual(errors, []);
        assert.ok(Math.abs(settled.gap) <= 1, `${name}: settled ${settled.gap}px from the end`);
        assert.equal(settled.isAtEnd, true, `${name}: isAtEnd`);
        await page.close();
    }
    console.log("Data changes: every case settles at the end.");
} finally {
    await browser.close();
}
