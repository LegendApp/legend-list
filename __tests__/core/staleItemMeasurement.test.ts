import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as calculate from "../../src/core/calculateItemsInView";
import { measureContainersInLayoutEffect } from "../../src/core/measureContainersInLayoutEffect";
import { measureContainersInLayoutEffect as measureNative } from "../../src/core/measureContainersInLayoutEffect.native";
import { updateItemSizes } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { buildSectionListData } from "../../src/section-list/flattenSections";
import { createMockContext } from "../__mocks__/createMockContext";

const pinned = { fixed: 75, id: "pinned" };
const skeleton: { fixed: number | undefined; id: string } = { fixed: undefined, id: "skeleton" };
const size = { height: 60, width: 400 };
const previousPlatform = Platform.OS;

afterEach(() => {
    Platform.OS = previousPlatform;
    mock.restore();
});

function context() {
    Platform.OS = "web";
    spyOn(calculate, "calculateItemsInView").mockImplementation(() => {});
    const ctx = createMockContext(
        {},
        {
            didContainersLayout: true,
            didFinishInitialScroll: true,
            indexByKey: new Map([["pinned", 0]]),
            props: {
                data: [pinned],
                getFixedItemSize: (item) => item.fixed,
                keyExtractor: (item) => item.id,
            },
        },
    );
    ctx.values.set("containerItemKey0", "pinned");
    ctx.state.sizes.set("pinned", 75);
    ctx.state.sizesKnown.set("pinned", 75);
    ctx.state.containerItemKeys.set("pinned", 0);
    return ctx;
}

describe("measurement during data replacement", () => {
    it("preserves pinned 75px while the stale index points to a 60px skeleton", async () => {
        const ctx = context();
        const fixed = mock((item) => item.fixed);
        ctx.state.props.getFixedItemSize = fixed;
        ctx.state.props.data = [skeleton];
        const retry = mock(() => updateItemSizes(ctx, { containerId: 0, itemKey: "pinned", size }));
        ctx.containerLayoutTriggers.set(0, retry);
        updateItemSizes(ctx, { containerId: 0, itemKey: "pinned", size });
        expect(ctx.state.sizesKnown.get("pinned")).toBe(75);
        expect(fixed).not.toHaveBeenCalled();
        expect(ctx.state.containerItemMetadata.has(0)).toBe(false);
        ctx.state.props.data = [pinned];
        await Promise.resolve();
        expect(retry).toHaveBeenCalledTimes(1);
        expect(ctx.state.sizesKnown.get("pinned")).toBe(75);
        ctx.state.scheduledWork.dispose();
    });

    for (const change of ["prepend", "reorder"] as const) {
        it(`retries dynamic measurements after a ${change} refreshes the mapping`, async () => {
            const ctx = context();
            ctx.state.props.getFixedItemSize = undefined;
            ctx.state.props.data = change === "reorder" ? [skeleton, pinned] : [pinned];
            ctx.state.indexByKey.set("pinned", change === "reorder" ? 1 : 0);
            ctx.state.props.data = change === "reorder" ? [pinned, skeleton] : [skeleton, pinned];
            const index = change === "reorder" ? 0 : 1;
            const retry = mock(() => updateItemSizes(ctx, { containerId: 0, itemKey: "pinned", size }));
            ctx.containerLayoutTriggers.set(0, retry);
            updateItemSizes(ctx, { containerId: 0, itemKey: "pinned", size });
            expect(ctx.state.sizesKnown.get("pinned")).toBe(75);
            ctx.state.indexByKey.set("pinned", index);
            await Promise.resolve();
            expect(retry).toHaveBeenCalledTimes(1);
            expect(ctx.state.sizesKnown.get("pinned")).toBe(60);
            ctx.state.scheduledWork.dispose();
        });
    }

    it("retries section rows after section headers move their indices", async () => {
        const ctx = context();
        const flatten = (prepend: boolean) =>
            buildSectionListData({
                renderSectionHeader: () => null,
                sections: [
                    ...(prepend ? [{ data: [skeleton], key: "loading" }] : []),
                    { data: [pinned], key: "saved" },
                ],
                stickySectionHeadersEnabled: true,
            }).data;
        const key = "saved:item:pinned";
        ctx.state.props.keyExtractor = (item) => item.key;
        ctx.state.props.getFixedItemSize = undefined;
        ctx.state.props.data = flatten(false);
        ctx.state.indexByKey = new Map([[key, 1]]);
        ctx.values.set("containerItemKey0", key);
        ctx.state.sizesKnown.set(key, 75);
        ctx.state.sizes.set(key, 75);
        ctx.state.props.data = flatten(true);
        const retry = mock(() => updateItemSizes(ctx, { containerId: 0, itemKey: key, size }));
        ctx.containerLayoutTriggers.set(0, retry);
        updateItemSizes(ctx, { containerId: 0, itemKey: key, size });
        expect(ctx.state.sizesKnown.get(key)).toBe(75);
        ctx.state.indexByKey.set(key, 3);
        await Promise.resolve();
        expect(retry).toHaveBeenCalledTimes(1);
        expect(ctx.state.sizesKnown.get(key)).toBe(60);
        ctx.state.scheduledWork.dispose();
    });

    it("uses numeric index keys without a keyExtractor", () => {
        const ctx = context();
        ctx.state.props.keyExtractor = undefined;
        ctx.state.props.getFixedItemSize = undefined;
        const key = 0 as unknown as string;
        ctx.values.set("containerItemKey0", key);
        ctx.state.indexByKey = new Map([[key, 0]]);
        updateItemSizes(ctx, { containerId: 0, itemKey: key, size });
        expect(ctx.state.sizesKnown.get(key)).toBe(60);
        ctx.state.scheduledWork.dispose();
    });

    it("retries an unavailable index and measures the current assignment", async () => {
        const ctx = context();
        ctx.state.indexByKey.clear();
        const retry = mock(() => updateItemSizes(ctx, { containerId: 0, itemKey: "skeleton", size }));
        ctx.containerLayoutTriggers.set(0, retry);
        updateItemSizes(ctx, { containerId: 0, itemKey: "pinned", size });
        expect(ctx.state.sizesKnown.get("pinned")).toBe(75);
        ctx.state.props.data = [skeleton];
        ctx.values.set("containerItemKey0", "skeleton");
        ctx.state.indexByKey.set("skeleton", 0);
        await Promise.resolve();
        expect(retry).toHaveBeenCalledTimes(1);
        expect(ctx.state.sizesKnown.get("skeleton")).toBe(60);
        ctx.state.scheduledWork.dispose();
    });

    it("invalidates older native callbacks even when the new pass must retry", async () => {
        const ctx = context();
        ctx.state.props.getFixedItemSize = undefined;
        let deliver: (x: number, y: number, width: number, height: number) => void = () => {};
        ctx.viewRefs.set(0, {
            current: {
                measure: (callback: typeof deliver) => {
                    deliver = callback;
                },
            },
        } as any);
        measureNative(ctx);
        ctx.state.props.data = [skeleton, pinned];
        measureNative(ctx);
        ctx.state.indexByKey.set("pinned", 1);
        deliver(0, 0, 400, 60);
        expect(ctx.state.sizesKnown.get("pinned")).toBe(75);
        ctx.state.scheduledWork.dispose();
        await Promise.resolve();
    });

    for (const native of [false, true]) {
        it(`rejects stale metadata before ${native ? "native" : "web"} layout measurement`, async () => {
            const ctx = context();
            ctx.state.props.data = [skeleton];
            const fixed = mock((item) => item.fixed);
            ctx.state.props.getFixedItemSize = fixed;
            const measure = mock((callback) => callback(0, 0, 400, 60));
            const rect = mock(() => size);
            ctx.viewRefs.set(0, { current: { getBoundingClientRect: rect, measure } } as any);
            const retry = mock(() => {});
            ctx.containerLayoutTriggers.set(0, retry);
            (native ? measureNative : measureContainersInLayoutEffect)(ctx);
            expect(ctx.state.sizesKnown.get("pinned")).toBe(75);
            expect(fixed).not.toHaveBeenCalled();
            expect(measure).not.toHaveBeenCalled();
            expect(rect).not.toHaveBeenCalled();
            await Promise.resolve();
            expect(retry).toHaveBeenCalledTimes(1);
            ctx.state.scheduledWork.dispose();
        });
    }
});
