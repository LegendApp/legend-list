import { describe, expect, it } from "bun:test";
import "../setup";

import { getContentSize } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

function createState(
    overrides: Partial<Omit<InternalState, "props">> & { props?: Partial<InternalState["props"]> } = {},
) {
    const { props: overrideProps, ...rest } = overrides;
    return createMockState({
        props: {
            onEndReachedThreshold: 0.2,
            ...(overrideProps ?? {}),
        },
        queuedInitialLayout: true,
        scrollLength: 300,
        totalSize: 900,
        ...rest,
    });
}

describe("checkAtBottom", () => {
    it("returns early when state is null or undefined", () => {
        const ctx = createMockContext();
        expect(() => checkAtBottom(ctx, null as any)).not.toThrow();
        expect(() => checkAtBottom(ctx, undefined as any)).not.toThrow();
    });

    it("returns early when content size is zero", () => {
        const ctx = createMockContext({ totalSize: 0 });
        const state = createState();

        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBe(false);
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("marks end reached and records snapshot when within threshold", () => {
        const ctx = createMockContext({ totalSize: 1200 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createState({
            props: {
                onEndReached: (payload) => calls.push(payload),
            },
            scroll: 850, // distance = 1200 - 850 - 300 = 50
        });

        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBe(true);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        expect(state.endReachedSnapshot).toEqual({
            atThreshold: false,
            contentSize: getContentSize(ctx),
            dataLength: state.props.data.length,
            scrollPosition: 850,
        });
    });

    it("does not trigger when far from the end", () => {
        const ctx = createMockContext({ totalSize: 2000 });
        const state = createState({
            props: {
                onEndReached: () => {
                    throw new Error("should not be called");
                },
            },
            scroll: 200,
        });

        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBe(false);
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("resets snapshot when scrolling away from the end", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const state = createState({ scroll: 650 });

        checkAtBottom(ctx, state);
        expect(state.isEndReached).toBe(true);
        expect(state.endReachedSnapshot).toBeDefined();

        state.scroll = 200;
        checkAtBottom(ctx, state);

        expect(state.isEndReached).toBe(false);
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("re-triggers when data length grows while staying near end", () => {
        const ctx = createMockContext({ totalSize: 1100 });
        const distances: number[] = [];
        const state = createState({
            props: {
                data: Array.from({ length: 5 }, (_, i) => i),
                onEndReached: ({ distanceFromEnd }) => distances.push(distanceFromEnd),
            },
            scroll: 760, // distance = 1100 - 760 - 300 = 40
        });

        checkAtBottom(ctx, state);
        expect(distances).toEqual([40]);

        state.props.data = Array.from({ length: 8 }, (_, i) => i);
        checkAtBottom(ctx, state);

        expect(distances).toEqual([40, 40]);
        expect(state.endReachedSnapshot?.dataLength).toBe(8);
    });

    it("re-triggers when content size increases", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const distances: number[] = [];
        const state = createState({
            props: {
                onEndReached: ({ distanceFromEnd }) => distances.push(distanceFromEnd),
            },
            scroll: 720,
        });

        checkAtBottom(ctx, state);
        expect(distances).toEqual([-20]);

        ctx.values.set("totalSize", 1040);
        state.totalSize = 1040;
        checkAtBottom(ctx, state);

        expect(distances).toEqual([-20, 20]);
        expect(state.endReachedSnapshot?.contentSize).toBe(getContentSize(ctx));
    });
});
