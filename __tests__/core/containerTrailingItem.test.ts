import { describe, expect, it } from "bun:test";
import "../setup";

import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { clearContainerTrailingItem, updateContainerTrailingItem } from "../../src/core/containerTrailingItem";
import { syncMountedContainer } from "../../src/core/syncMountedContainer";
import { peek$, set$ } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValue } from "../helpers/layoutArrays";

describe("containerTrailingItem", () => {
    it("publishes the next item for a container when the list renders separators", () => {
        const data = [{ id: "item-0" }, { id: "item-1" }, { id: "item-2" }];
        const ctx = createMockContext(
            {},
            {
                props: { data, hasItemSeparator: true, keyExtractor: (item: { id: string }) => item.id },
            },
        );

        updateContainerTrailingItem(ctx, 0, 1);

        expect(peek$(ctx, "containerItemTrailingData0")).toBe(data[2]);
    });

    it("publishes undefined for the last item so its separator has no trailing item", () => {
        const data = [{ id: "item-0" }, { id: "item-1" }];
        const ctx = createMockContext({}, { props: { data, hasItemSeparator: true } });

        updateContainerTrailingItem(ctx, 0, 1);

        expect(peek$(ctx, "containerItemTrailingData0")).toBeUndefined();
    });

    it("does not publish anything when the list has no separator", () => {
        const data = [{ id: "item-0" }, { id: "item-1" }];
        const ctx = createMockContext({}, { props: { data, hasItemSeparator: false } });

        updateContainerTrailingItem(ctx, 0, 0);

        expect(ctx.values.has("containerItemTrailingData0")).toBe(false);
    });

    it("keeps the previous trailing item when itemsAreEqual reports the new one as equal", () => {
        const previousTrailing = { id: "item-1", label: "Beta" };
        const nextTrailing = { id: "item-1", label: "Beta" };
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: [{ id: "item-0" }, nextTrailing],
                    hasItemSeparator: true,
                    itemsAreEqual: (previous: any, next: any) => previous.label === next.label,
                    keyExtractor: (item: { id: string }) => item.id,
                },
            },
        );
        set$(ctx, "containerItemTrailingData0", previousTrailing);

        updateContainerTrailingItem(ctx, 0, 0);

        expect(peek$(ctx, "containerItemTrailingData0")).toBe(previousTrailing);
    });

    it("publishes the new trailing item when itemsAreEqual reports a change", () => {
        const previousTrailing = { id: "item-1", label: "Beta" };
        const nextTrailing = { id: "item-1", label: "Beta changed" };
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: [{ id: "item-0" }, nextTrailing],
                    hasItemSeparator: true,
                    itemsAreEqual: (previous: any, next: any) => previous.label === next.label,
                    keyExtractor: (item: { id: string }) => item.id,
                },
            },
        );
        set$(ctx, "containerItemTrailingData0", previousTrailing);

        updateContainerTrailingItem(ctx, 0, 0);

        expect(peek$(ctx, "containerItemTrailingData0")).toBe(nextTrailing);
    });

    it("publishes the new trailing item when the key changed even if itemsAreEqual would match", () => {
        const previousTrailing = { id: "item-1", label: "Beta" };
        const nextTrailing = { id: "item-2", label: "Beta" };
        const ctx = createMockContext(
            {},
            {
                props: {
                    data: [{ id: "item-0" }, nextTrailing],
                    hasItemSeparator: true,
                    itemsAreEqual: (previous: any, next: any) => previous.label === next.label,
                    keyExtractor: (item: { id: string }) => item.id,
                },
            },
        );
        set$(ctx, "containerItemTrailingData0", previousTrailing);

        updateContainerTrailingItem(ctx, 0, 0);

        expect(peek$(ctx, "containerItemTrailingData0")).toBe(nextTrailing);
    });

    it("clears the trailing item when a container is deallocated", () => {
        const data = [{ id: "item-0" }, { id: "item-1" }];
        const ctx = createMockContext({}, { props: { data, hasItemSeparator: true } });
        set$(ctx, "containerItemTrailingData0", data[1]);

        clearContainerTrailingItem(ctx, 0);

        expect(peek$(ctx, "containerItemTrailingData0")).toBeUndefined();
    });

    it("publishes the trailing item when a mounted container is synced", () => {
        const data = [{ id: "item-0" }, { id: "item-1" }];
        const ctx = createMockContext(
            {},
            {
                idCache: ["item-0", "item-1"],
                props: { data, hasItemSeparator: true, keyExtractor: (item?: { id: string }) => item?.id },
            },
        );
        set$(ctx, "containerItemKey0", "item-0");

        syncMountedContainer(ctx, 0, 0, { updateLayout: false });

        expect(peek$(ctx, "containerItemTrailingData0")).toBe(data[1]);
    });

    it("publishes trailing items for the containers allocated by calculateItemsInView", () => {
        const itemSize = 100;
        const data = Array.from({ length: 5 }, (_, index) => ({ id: `item_${index}` }));
        const ctx = createMockContext(
            {
                headerSize: 0,
                numColumns: 1,
                numContainers: 5,
                stylePaddingTop: 0,
                totalSize: data.length * itemSize,
            },
            {
                props: {
                    data,
                    drawDistance: 0,
                    getFixedItemSize: () => itemSize,
                    hasItemSeparator: true,
                    scrollBuffer: 0,
                },
            },
        );
        const state = ctx.state;
        state.scroll = 0;
        state.scrollLength = 1000;
        state.totalSize = data.length * itemSize;

        for (let index = 0; index < data.length; index++) {
            const key = `item_${index}`;
            state.idCache[index] = key;
            state.indexByKey.set(key, index);
            setLayoutValue(state, "positions", key, index * itemSize);
            state.sizes.set(key, itemSize);
            state.sizesKnown.set(key, itemSize);
        }

        calculateItemsInView(ctx);

        const trailingByIndex = new Map<number, unknown>();
        for (let containerId = 0; containerId < data.length; containerId++) {
            const itemKey = peek$(ctx, `containerItemKey${containerId}`);
            if (itemKey === undefined) {
                continue;
            }

            trailingByIndex.set(state.indexByKey.get(itemKey)!, peek$(ctx, `containerItemTrailingData${containerId}`));
        }

        expect(trailingByIndex.size).toBe(data.length);
        for (const [itemIndex, trailingItem] of trailingByIndex) {
            expect(trailingItem).toBe(data[itemIndex + 1]);
        }
    });
});
