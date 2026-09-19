import { describe, expect, it } from "bun:test";
import "../setup";

import { updateScroll } from "../../src/core/updateScroll";
import { checkThresholds } from "../../src/utils/checkThresholds";
import { prepareReachedEdgeForNextUserScroll } from "../../src/utils/edgeReachedGate";
import { setDidLayout } from "../../src/utils/setDidLayout";
import { createMockContext } from "../__mocks__/createMockContext";

const viewport = 474;
const heights = [1, 24, 237, 450, 473, 473.75, 474, 474.25, 475, 498, 566, 720];

describe("content near or below viewport height", () => {
    for (const height of heights) {
        for (const threshold of [0.01, 0.1, 0.5]) {
            for (const bothEdges of [false, true]) {
                it(`height ${height}, threshold ${threshold}, both edges ${bothEdges}`, () => {
                    const ends: number[] = [];
                    const starts: number[] = [];
                    const ctx = createMockContext(
                        { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: height },
                        {
                            props: {
                                data: [{ id: 1 }],
                                onEndReached: ({ distanceFromEnd }) => ends.push(distanceFromEnd),
                                onEndReachedThreshold: threshold,
                                onStartReached: bothEdges
                                    ? ({ distanceFromStart }) => starts.push(distanceFromStart)
                                    : undefined,
                                onStartReachedThreshold: threshold,
                            },
                            queuedInitialLayout: false,
                            scroll: 0,
                            scrollLength: viewport,
                        },
                    );
                    checkThresholds(ctx);
                    expect(ends).toEqual([]);
                    setDidLayout(ctx);
                    const initiallyNearEnd = height <= viewport * (1 + threshold);
                    expect(ends).toEqual(initiallyNearEnd ? [height - viewport] : []);
                    expect(starts).toEqual(bothEdges ? [0] : []);

                    // Layout rechecks and zero-movement native events must not
                    // turn an unscrollable list into an endless pagination loop.
                    for (let i = 0; i < 5; i++) {
                        checkThresholds(ctx);
                        updateScroll(ctx, 0, true, { fromNativeScrollEvent: true });
                    }
                    expect(ends).toHaveLength(initiallyNearEnd ? 1 : 0);
                    if (height <= viewport) {
                        expect(ctx.values.get("isAtEnd")).toBe(true);
                        prepareReachedEdgeForNextUserScroll(ctx);
                        updateScroll(ctx, 0, true, { fromNativeScrollEvent: true });
                        expect(ends).toHaveLength(1);
                    } else {
                        if (!initiallyNearEnd) prepareReachedEdgeForNextUserScroll(ctx);
                        for (let step = 1; step <= 4; step++) {
                            updateScroll(ctx, ((height - viewport) * step) / 4, true, { fromNativeScrollEvent: true });
                        }
                        expect(ctx.state.scroll).toBeCloseTo(height - viewport);
                        expect(ctx.values.get("isAtEnd")).toBe(true);
                        expect(ends).toHaveLength(1);
                        expect(ends[0]).toBeLessThanOrEqual(viewport * threshold);
                    }
                    ctx.state.scheduledWork.dispose();
                });
            }
        }
    }
});
