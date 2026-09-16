// Start `bun run dev:fixtures --port 5188` in example-web first.
// Run with Node and Playwright installed, or point PLAYWRIGHT_MODULE at its entrypoint.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
        window.imagePriorityCommits = [];
        window.addEventListener("recycle-image-commit", (event) => window.imagePriorityCommits.push(event.detail));
    });
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname === "/__fixtures/recycle-image")
            requests.push({ index: Number(url.searchParams.get("index")), url: url.href });
    });
    const record = (name, direction, minimum = 3) => {
        const indices = requests.splice(0).map((request) => request.index);
        const ordered =
            indices.length >= minimum &&
            indices.every((value, i) => i === 0 || (value - indices[i - 1]) * direction > 0);
        results.push({ name, indices, ordered });
    };
    const settle = async () => {
        await page.waitForTimeout(1800);
        await page.waitForLoadState("networkidle");
    };
    await page.goto(`${process.env.FIXTURE_URL || "http://127.0.0.1:5188"}/recycle-image-priority`);
    await settle();
    record("initial top / 25 ms", 1);
    await page.getByRole("combobox").selectOption("60");
    await page.getByRole("button", { name: "Restart at top", exact: true }).click();
    await settle();
    record("initial top / 60 ms", 1);
    const list = page.getByTestId("image-priority-list");
    await list.hover();
    for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 480);
        await settle();
        record(`fast wheel down ${i + 1} / 60 ms`, 1, i === 0 ? 1 : 3);
    }
    for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, -480);
        await settle();
        record(`fast wheel up ${i + 1} / 60 ms`, -1);
    }
    for (const direction of [1, -1]) {
        const firstCommit = await page.evaluate(() => window.imagePriorityCommits.length);
        requests.length = 0;
        // No settle between wheel events: scroll input continues while 60 ms rows
        // occupy JS. Match each actual request to its committed image assignment.
        for (let i = 0; i < 6; i++) await page.mouse.wheel(0, direction * 480);
        await settle();
        const commits = await page.evaluate((start) => window.imagePriorityCommits.slice(start), firstCommit);
        const commitByUrl = new Map();
        const duplicateAssignments = [];
        commits.forEach((urls, batch) =>
            urls.forEach((url) => {
                if (commitByUrl.has(url)) duplicateAssignments.push(url);
                commitByUrl.set(url, batch);
            }),
        );
        const batches = commits.map(() => []);
        const unmatched = [];
        for (const request of requests.splice(0)) {
            const batch = commitByUrl.get(request.url);
            if (batch === undefined) unmatched.push(request);
            else batches[batch].push(request.index);
        }
        const multipleRowBatches = batches.filter((batch) => batch.length > 1);
        const ordered =
            duplicateAssignments.length === 0 &&
            unmatched.length === 0 &&
            multipleRowBatches.length >= 2 &&
            batches.every((batch) => batch.every((index, i) => i === 0 || (index - batch[i - 1]) * direction > 0));
        results.push({
            name: `continuous wheel ${direction > 0 ? "down" : "up"} / 60 ms`,
            batches,
            duplicateAssignments,
            unmatched,
            ordered,
        });
    }
    await page.getByRole("button", { name: "Restart at end", exact: true }).click();
    await settle();
    record("initial end / 60 ms", -1);
    await page.getByRole("button", { name: "Clear log", exact: true }).click();
    await list.hover();
    await page.mouse.wheel(0, -480);
    await settle();
    record("wheel up from end / 60 ms", -1);
    // Check the fixture's independently collected Resource Timing log as well.
    const timing = await page
        .getByTestId("image-request-log")
        .locator("li")
        .evaluateAll((rows) =>
            rows.map((row) => ({
                index: Number(row.dataset.index),
                time: Number(row.dataset.time),
            })),
        );
    results.push({ name: "resource timing after upward scroll", timing });
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });
    console.log(JSON.stringify({ errors, results }, null, 2));
    if (process.env.RESULT_PATH) await writeFile(process.env.RESULT_PATH, JSON.stringify({ errors, results }, null, 2));
    if (!process.env.OBSERVE_ONLY) {
        assert.deepEqual(errors, []);
        for (const result of results.filter((result) => "ordered" in result))
            assert.equal(result.ordered, true, result.name);
        assert.ok(timing.length >= 3);
        assert.ok(timing.every((entry, i) => i === 0 || entry.index < timing[i - 1].index));
    }
} finally {
    await browser.close();
}
