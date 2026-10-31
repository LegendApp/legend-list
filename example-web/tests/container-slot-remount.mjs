// Run with Bun and installed root/example dependencies; set PLAYWRIGHT_MODULE if needed.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const fixture = `
import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ContainerSlotBase } from "./src/components/ContainerSlot";
import { ContainerLayoutCoordinator } from "./src/components/ContainerLayoutCoordinator";
import { peek$, set$, StateProvider, useStateContext } from "./src/state/state";

const order = () => [...document.querySelectorAll("[data-row]")].map(el => el.dataset.row);
function Row({id, itemKey}) {
    const ctx = useStateContext();
    const ref = React.useRef(null);
    ctx.viewRefs.set(id, ref);
    React.useLayoutEffect(() => { window.beforeSort = order(); }, []);
    return <div ref={ref} data-row={itemKey}>{itemKey}</div>;
}
function Slots() {
    const ctx = useStateContext();
    if (!ctx.values.has("containerItemKey1")) {
        ctx.values.set("containerLayoutEpoch", 0);
        for (const [id, key, index] of [[0, "middle", 5], [1, "first", 0], [2, "last", 9]]) {
            ctx.values.set("containerItemKey" + id, key);
            ctx.values.set("containerItemIndex" + id, index);
        }
    }
    window.assign = key => flushSync(() => {
        set$(ctx, "containerItemKey0", key);
        // Container reassignment wakes the same parent effect in calculateItemsInView.
        set$(ctx, "containerLayoutEpoch", peek$(ctx, "containerLayoutEpoch") + 1);
    });
    return <ContainerLayoutCoordinator>{[0, 1, 2].map(id =>
        <ContainerSlotBase key={id} id={id} ContainerComponent={Row}
            horizontal={false} recycleItems getRenderedItem={() => null} />
    )}</ContainerLayoutCoordinator>;
}
flushSync(() => createRoot(document.getElementById("root")).render(<StateProvider><Slots /></StateProvider>));
window.order = order;
`;
const built = await Bun.build({
    define: { global: "globalThis", __DEV__: "false", "process.env.NODE_ENV": '"production"' },
    entrypoints: ["slot-remount:fixture"],
    plugins: [
        {
            name: "fixture",
            setup(build) {
                build.onResolve({ filter: /^slot-remount:fixture$/ }, () => ({
                    namespace: "fixture",
                    path: "entry.tsx",
                }));
                build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
                    contents: fixture,
                    loader: "tsx",
                    resolveDir: root,
                }));
                build.onResolve({ filter: /^(react|react-dom|scheduler)(\/.*)?$/ }, (args) => ({
                    path: Bun.resolveSync(args.path, `${root}/example/`),
                }));
            },
        },
    ],
    target: "browser",
    tsconfig: `${root}/tsconfig.json`,
});
assert.equal(built.success, true, built.logs.map(String).join("\n"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => { errors.push(error.message); console.error(error.stack); });
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: await built.outputs[0].text(), type: "module" });
    await page.waitForFunction(() => typeof window.assign === "function");
    assert.deepEqual(await page.evaluate(() => window.order()), ["first", "middle", "last"]);
    for (let cycle = 0; cycle < 5; cycle++) {
        assert.deepEqual(await page.evaluate(() => { window.assign(undefined); return window.order(); }), ["first", "last"]);
        const result = await page.evaluate(() => {
            window.assign("reused");
            return { beforeSort: window.beforeSort, committed: window.order() };
        });
        assert.deepEqual(result.beforeSort, ["reused", "first", "last"]);
        assert.deepEqual(result.committed, ["first", "reused", "last"]);
    }
    assert.deepEqual(errors, []);
    console.log("Empty slot remounts: React inserts before row 0; coordinator restores item order before paint, 5/5.");
} finally {
    await browser.close();
}
