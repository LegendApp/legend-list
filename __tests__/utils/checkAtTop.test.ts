import { describe, expect, it } from "bun:test";
import "../setup";

import type { InternalState } from "../../src/types";
import { checkAtTop } from "../../src/utils/checkAtTop";
import { createMockState } from "../__mocks__/createMockState";

function createState(overrides: Partial<InternalState> = {}) {
    const { props: overrideProps, ...rest } = overrides;
    return createMockState({
        scrollLength: 200,
        props: {
            onStartReachedThreshold: 0.2,
            ...(overrideProps ?? {}),
        },
        ...rest,
    });
}

describe("checkAtTop", () => {
    it("returns early when state is null or undefined", () => {
        expect(() => checkAtTop(null as any)).not.toThrow();
        expect(() => checkAtTop(undefined as any)).not.toThrow();
    });

    it("marks start reached and records snapshot when within threshold", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const state = createState({
            scroll: 10,
            props: {
                onStartReached: (payload) => calls.push(payload),
            },
        });

        checkAtTop(state);

        expect(state.isAtStart).toBe(false);
        expect(state.isStartReached).toBe(true);
        expect(calls).toEqual([{ distanceFromStart: 10 }]);
        expect(state.startReachedSnapshot).toEqual({
            scrollPosition: 10,
            contentSize: 1000,
            dataLength: state.props.data.length,
            atThreshold: false,
        });
    });

    it("does not trigger when outside the threshold window", () => {
        const calls: Array<{ distanceFromStart: number }> = [];
        const state = createState({
            scroll: 150,
            props: {
                onStartReached: (payload) => calls.push(payload),
            },
        });

        checkAtTop(state);

        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();
        expect(calls.length).toBe(0);
    });

    it("resets snapshot and flag when scrolling away from start", () => {
        const state = createState({ scroll: 10 });
        checkAtTop(state);
        expect(state.isStartReached).toBe(true);
        expect(state.startReachedSnapshot).toBeDefined();

        state.scroll = 120; // Far beyond hysteresis window
        checkAtTop(state);

        expect(state.isStartReached).toBe(false);
        expect(state.startReachedSnapshot).toBeUndefined();
    });

    it("re-triggers when data length changes while still near the start", () => {
        const distances: number[] = [];
        const state = createState({
            scroll: 15,
            props: {
                data: [1, 2, 3],
                onStartReached: ({ distanceFromStart }) => distances.push(distanceFromStart),
            },
        });

        checkAtTop(state);
        expect(distances).toEqual([15]);

        state.props.data = [0, 1, 2, 3, 4];
        checkAtTop(state);

        expect(distances).toEqual([15, 15]);
        expect(state.startReachedSnapshot?.dataLength).toBe(5);
    });

    it("re-triggers when total content size increases", () => {
        const distances: number[] = [];
        const state = createState({
            scroll: 12,
            props: {
                onStartReached: ({ distanceFromStart }) => distances.push(distanceFromStart),
            },
        });

        checkAtTop(state);
        expect(distances).toEqual([12]);

        state.totalSize = 1500;
        checkAtTop(state);

        expect(distances).toEqual([12, 12]);
        expect(state.startReachedSnapshot?.contentSize).toBe(1500);
    });
});
