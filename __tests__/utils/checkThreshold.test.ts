import { describe, expect, it } from "bun:test";
import "../setup";

import type { ThresholdSnapshot } from "../../src/types.internal";
import { checkThreshold } from "../../src/utils/checkThreshold";

const baseContext = (overrides: Partial<{ scrollPosition: number; contentSize?: number; dataLength?: number }> = {}) =>
    ({
        contentSize: 500,
        dataLength: 5,
        scrollPosition: 200,
        ...overrides,
    }) as const;

describe("checkThreshold", () => {
    it("retries a suppressed callback without recording a reached snapshot", () => {
        const snapshots: Array<ThresholdSnapshot | undefined> = [];
        const reached = checkThreshold(
            10,
            false,
            50,
            false,
            undefined,
            baseContext(),
            () => false,
            (snapshot) => {
                snapshots.push(snapshot);
            },
        );
        expect(reached).toBe(false);
        expect(snapshots).toEqual([]);

        expect(
            checkThreshold(
                10,
                false,
                50,
                reached,
                undefined,
                baseContext(),
                () => true,
                (snapshot) => {
                    snapshots.push(snapshot);
                },
            ),
        ).toBe(true);
        expect(snapshots).toHaveLength(1);
    });
    it("fires when starting inside threshold with wasReached null", () => {
        const onReachedCalls: number[] = [];
        const snapshotCalls: Array<ThresholdSnapshot | undefined> = [];

        checkThreshold(
            10,
            false,
            50,
            null,
            undefined,
            baseContext(),
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (snap) => snapshotCalls.push(snap),
        );

        expect(onReachedCalls).toEqual([10]);
        expect(snapshotCalls.at(-1)).toMatchObject({
            atThreshold: false,
            contentSize: 500,
            dataLength: 5,
            scrollPosition: 200,
        });
    });

    it("does not fire when starting outside threshold with wasReached null", () => {
        const onReachedCalls: number[] = [];
        const snapshotCalls: Array<ThresholdSnapshot | undefined> = [];

        checkThreshold(
            200,
            false,
            50,
            null,
            undefined,
            baseContext(),
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (snap) => snapshotCalls.push(snap),
        );

        expect(onReachedCalls).toEqual([]);
        expect(snapshotCalls).toEqual([]);
    });

    it("does not fire when overscrolling negative while wasReached is null", () => {
        const onReachedCalls: number[] = [];
        const snapshotCalls: Array<ThresholdSnapshot | undefined> = [];

        checkThreshold(
            -200,
            false,
            50,
            null,
            undefined,
            baseContext(),
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (snap) => snapshotCalls.push(snap),
        );

        expect(onReachedCalls).toEqual([]);
        expect(snapshotCalls).toEqual([]);
    });

    it("marks reached and stores snapshot when entering threshold", () => {
        const onReachedCalls: number[] = [];
        const snapshotCalls: Array<ThresholdSnapshot | undefined> = [];

        checkThreshold(
            20,
            false,
            50,
            false,
            undefined,
            baseContext(),
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (snap) => snapshotCalls.push(snap),
        );

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

        const onReachedCalls: number[] = [];
        checkThreshold(
            20,
            false,
            50,
            false,
            snapshot,
            context,
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (snap) => snapshotCalls.push(snap),
        );
        expect(onReachedCalls).toEqual([20]);

        checkThreshold(
            200,
            false,
            50,
            true,
            snapshotCalls.at(-1),
            context,
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (snap) => snapshotCalls.push(snap),
        );

        expect(onReachedCalls).toEqual([20]);
        expect(snapshotCalls.at(-1)).toBeUndefined();
    });

    it("updates its snapshot without re-firing when content changes", () => {
        const onReachedCalls: number[] = [];
        let snapshot: ThresholdSnapshot | undefined;

        const context = baseContext({ contentSize: 500 });
        checkThreshold(
            20,
            false,
            50,
            false,
            undefined,
            context,
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (s) => {
                snapshot = s;
            },
        );
        onReachedCalls.length = 0;

        const changedContext = baseContext({ contentSize: 700 });
        checkThreshold(
            30,
            false,
            50,
            true,
            snapshot,
            changedContext,
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (s) => {
                snapshot = s;
            },
        );

        expect(onReachedCalls).toEqual([]);
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
        checkThreshold(
            10,
            false,
            50,
            false,
            snapshot,
            context,
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (s) => {
                snapshot = s;
            },
        );
        onReachedCalls.length = 0;

        checkThreshold(
            15,
            false,
            50,
            true,
            snapshot,
            context,
            (dist) => {
                onReachedCalls.push(dist);
                return true;
            },
            (s) => {
                snapshot = s;
            },
        );

        expect(onReachedCalls).toEqual([]);
    });
});
