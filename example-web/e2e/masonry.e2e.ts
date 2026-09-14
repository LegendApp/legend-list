import { expect, type Page, test } from "@playwright/test";

async function readLayout(page: Page) {
    return page.evaluate(async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const scroller = Array.from(document.querySelectorAll("div")).find(
            (element) =>
                element.scrollHeight > element.clientHeight + 300 && getComputedStyle(element).overflowY === "auto",
        );
        if (!scroller) throw new Error("Missing masonry scroll container");
        const viewport = scroller.getBoundingClientRect();
        const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-card-id]"))
            .map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    id: element.dataset.cardId!,
                    width: bounds.width,
                    x: bounds.x,
                    y: bounds.y,
                };
            })
            .filter((card) => card.y + card.height > viewport.y && card.y < viewport.bottom);
        const overlaps: string[][] = [];
        for (let i = 0; i < cards.length; i++) {
            for (let j = i + 1; j < cards.length; j++) {
                const a = cards[i];
                const b = cards[j];
                if (
                    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
                    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1
                )
                    overlaps.push([a.id, b.id]);
            }
        }
        return {
            cards,
            overlaps,
            scroll: scroller.scrollTop,
            viewportBottom: viewport.bottom,
            viewportTop: viewport.y,
        };
    });
}

async function scrollTo(page: Page, offset: number) {
    await page.evaluate((value) => {
        const scroller = Array.from(document.querySelectorAll("div")).find(
            (element) =>
                element.scrollHeight > element.clientHeight + 300 && getComputedStyle(element).overflowY === "auto",
        );
        if (!scroller) throw new Error("Missing masonry scroll container");
        scroller.scrollTop = value;
    }, offset);
    await expect.poll(async () => Math.abs((await readLayout(page)).scroll - offset)).toBeLessThan(2);
    await expect.poll(async () => (await readLayout(page)).cards.length).toBeGreaterThan(0);
    expect((await readLayout(page)).overlaps).toEqual([]);
}

for (const width of [1280, 768]) {
    test.describe(`${width}px viewport`, () => {
        test.use({ viewport: { height: 900, width } });
        test.beforeEach(async ({ page }) => {
            await page.goto("/masonry");
            await expect(page.getByRole("button", { exact: true, name: "Card 0" })).toBeVisible();
        });

        test("deep and reverse scroll preserve recycled card identity", async ({ page }) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            for (const offset of [1600, 3200, 900, 1400]) await scrollTo(page, offset);
            const layout = await readLayout(page);
            const card = layout.cards.find(
                (item) => item.y > layout.viewportTop + 10 && item.y + item.height < layout.viewportBottom,
            );
            expect(card).toBeDefined();
            await page.getByRole("button", { exact: true, name: `Card ${card!.id}` }).click();
            await expect(page.getByRole("status")).toHaveText(`Selected: ${card!.id} / Items: 80`);
            await scrollTo(page, 0);
            expect(errors).toEqual([]);
        });

        test("prepend preserves the visible anchor and append preserves selection", async ({ page }) => {
            await scrollTo(page, 1400);
            const before = await readLayout(page);
            // MVCP anchors the first visible data index, not DOM recycler order.
            const anchor = before.cards
                .sort((a, b) => Number(a.id) - Number(b.id))
                .find((card) => card.y >= before.viewportTop - 10)!;
            expect(anchor).toBeDefined();
            await page.getByRole("button", { exact: true, name: `Card ${anchor.id}` }).click();
            await page.getByRole("button", { exact: true, name: "Prepend" }).click();
            await expect(page.getByRole("status")).toHaveText(`Selected: ${anchor.id} / Items: 81`);
            await expect
                .poll(async () => {
                    const after = (await readLayout(page)).cards.find((card) => card.id === anchor.id);
                    return after ? Math.abs(after.y - anchor.y) : Number.POSITIVE_INFINITY;
                })
                .toBeLessThanOrEqual(2);
            await page.getByRole("button", { exact: true, name: "Append" }).click();
            await expect(page.getByRole("status")).toHaveText(`Selected: ${anchor.id} / Items: 82`);
            expect((await readLayout(page)).overlaps).toEqual([]);
        });

        test("column changes and tall-card reverse scrolling retain visible cards", async ({ page }) => {
            for (const columns of [4, 2, 3]) {
                await page.getByRole("button", { name: /^Columns:/ }).click();
                await expect(page.getByRole("button", { exact: true, name: `Columns: ${columns}` })).toBeVisible();
                await expect
                    .poll(async () => new Set((await readLayout(page)).cards.map((card) => Math.round(card.x))).size)
                    .toBe(columns);
                expect((await readLayout(page)).overlaps).toEqual([]);
            }
            await page.getByRole("button", { exact: true, name: "Toggle tall card" }).click();
            await expect
                .poll(async () => (await readLayout(page)).cards.find((card) => card.id === "1")?.height)
                .toBe(2000);
            await scrollTo(page, 2800);
            for (const offset of [1500, 1400, 1600, 1450]) {
                await scrollTo(page, offset);
                expect((await readLayout(page)).cards.some((card) => card.id === "1")).toBe(true);
            }
            await page.getByRole("button", { exact: true, name: "Reset" }).click();
            await expect(page.getByRole("status")).toHaveText("Selected: none / Items: 80");
            await scrollTo(page, 0);
            await expect
                .poll(async () => (await readLayout(page)).cards.find((card) => card.id === "1")?.height)
                .toBe(143);
        });
    });
}
