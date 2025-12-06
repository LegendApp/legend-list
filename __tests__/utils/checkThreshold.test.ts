import { describe, expect, it } from "bun:test";
import "../setup";

import { checkThreshold } from "../../src/utils/checkThreshold";
import type { ThresholdSnapshot } from "../../src/types";

const baseContext = (overrides: Partial<{ scrollPosition: number; contentSize?: number; dataLength?: number }> = {}) =>
    ({
        contentSize: 500,
        dataLength: 5,
        scrollPosition: 200,
        ...overrides,
    }) as const;

describe("checkThreshold", () => {
    it("returns null when starting inside threshold with wasReached null", () => {
        const onReached = () => {
            throw new Error("should not fire");
        };

        const result = checkThreshold(10, false, 50, null, undefined, baseContext(), onReached, () => {});

        expect(result).toBeNull();
    });

    it("returns false when starting outside threshold with wasReached null", () => {
        const result = checkThreshold(200, false, 50, null, undefined, baseContext(), () => {}, () => {});

        expect(result).toBe(false);
    });

    it("stays null when overscrolling negative while wasReached is null", () => {
        const result = checkThreshold(-200, false, 50, null, undefined, baseContext(), () => {}, () => {});

        expect(result).toBeNull();
    });

    it("marks reached and stores snapshot when entering threshold", () => {
        const onReachedCalls: number[] = [];
        const snapshotCalls: Array<ThresholdSnapshot | undefined> = [];

        const result = checkThreshold(
            20,
            false,
            50,
            false,
            undefined,
            baseContext(),
            (dist) => onReachedCalls.push(dist),
            (snap) => snapshotCalls.push(snap),
        );

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([20]);
        expect(snapshotCalls.at(-1)).toMatchObject({
            atThreshold: false,
            contentSize: 500,
            dataLength: 5,
            scrollPosition: 200,
        });
    });

    it("resets when moving beyond hysteresis distance", () => {
        const snapshotCalls: Array<ThresholdSnapshot | undefined> = [];
        const context = baseContext();
        const snapshot: ThresholdSnapshot | undefined = undefined;

        const reached = checkThreshold(20, false, 50, false, snapshot, context, () => {}, (snap) =>
            snapshotCalls.push(snap),
        );
        expect(reached).toBe(true);

        const reset = checkThreshold(200, false, 50, true, snapshotCalls.at(-1), context, () => {}, (snap) =>
            snapshotCalls.push(snap),
        );

        expect(reset).toBe(false);
        expect(snapshotCalls.at(-1)).toBeUndefined();
    });

    it("re-fires within threshold when content changes", () => {
        const onReachedCalls: number[] = [];
        let snapshot: ThresholdSnapshot | undefined;

        const context = baseContext({ contentSize: 500 });
        snapshot = checkThreshold(20, false, 50, false, undefined, context, (dist) => onReachedCalls.push(dist), (s) => {
            snapshot = s;
        }) as ThresholdSnapshot | undefined;
        onReachedCalls.length = 0;

        const changedContext = baseContext({ contentSize: 700 });
        const result = checkThreshold(30, false, 50, true, snapshot, changedContext, (dist) => onReachedCalls.push(dist), (s) => {
            snapshot = s;
        });

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([30]);
        expect(snapshot).toMatchObject({
            contentSize: 700,
            dataLength: changedContext.dataLength,
            scrollPosition: changedContext.scrollPosition,
        });
    });

    it("does not re-fire within threshold when nothing changes", () => {
        const onReachedCalls: number[] = [];
        let snapshot: ThresholdSnapshot | undefined;

        const context = baseContext();
        checkThreshold(10, false, 50, false, snapshot, context, (dist) => onReachedCalls.push(dist), (s) => {
            snapshot = s;
        });
        onReachedCalls.length = 0;

        const result = checkThreshold(15, false, 50, true, snapshot, context, (dist) => onReachedCalls.push(dist), (s) => {
            snapshot = s;
        });

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([]);
    });
});
