import { expect, it } from "bun:test";
import "../setup";

import { updateViewableItems } from "../../src/core/viewability";
import type { OnViewableItemsChangedInfo } from "../../src/types.base";
import { createMockContext } from "../__mocks__/createMockContext";
import { setLayoutValues } from "../helpers/layoutStore";

for (const minimumViewTime of [1e15, Number.POSITIVE_INFINITY]) {
    it(`does not report early with a real timer and minimumViewTime=${minimumViewTime}`, async () => {
        const ctx = createMockContext();
        const calls: OnViewableItemsChangedInfo[] = [];
        Object.assign(ctx.state, {
            idCache: ["a"],
            indexByKey: new Map([["a", 0]]),
            scroll: 0,
            sizes: new Map([["a", 100]]),
        });
        ctx.state.props.data = [{ id: "a" }];
        setLayoutValues(ctx.state, "positions", [0]);
        ctx.state.props.keyExtractor = (item: { id: string }) => item.id;
        try {
            updateViewableItems(
                ctx,
                [
                    {
                        onViewableItemsChanged: (info) => calls.push(info),
                        viewabilityConfig: { itemVisiblePercentThreshold: 50, minimumViewTime },
                    },
                ],
                200,
                0,
                0,
            );
            // Overflowing platform timers can be coerced to 1ms. A real event loop
            // distinguishes that failure from fake-clock scheduling conventions.
            await new Promise((resolve) => setTimeout(resolve, 30));
            expect(calls).toEqual([]);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });
}
