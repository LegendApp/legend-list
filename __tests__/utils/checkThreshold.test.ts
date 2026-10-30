import { describe, expect, it } from "bun:test";
import "../setup";

import type { ThresholdSnapshot } from "../../src/types.internal";
import { checkThreshold } from "../../src/utils/checkThreshold";

const data = [0, 1, 2, 3, 4];
const baseContext = (overrides: Partial<{ dataLength?: number }> = {}) =>
    ({
        contentSize: 500,
        data,
        dataLength: 5,
        scroll: 0,
        ...overrides,
    }) as const;

describe("checkThreshold", () => {
    it("retains the last dispatched snapshot when changed content is suppressed", () => {
        const snapshot: ThresholdSnapshot = baseContext();
        const snapshots: Array<ThresholdSnapshot | undefined> = [];
        expect(
            checkThreshold(
                10,
                false,
                50,
                true,
                snapshot,
                baseContext({ dataLength: 7 }),
                () => false,
                (next) => snapshots.push(next),
            ),
        ).toBe(true);
        expect(snapshots).toHaveLength(0);
        expect(snapshot.dataLength).toBe(5);
    });

    it("retains the stored content length inside the hysteresis band", () => {
        const snapshot: ThresholdSnapshot = baseContext();
        const snapshots: Array<ThresholdSnapshot | undefined> = [];
        expect(
            checkThreshold(
                51,
                false,
                50,
                true,
                snapshot,
                baseContext(),
                () => {
                    throw new Error("outside threshold");
                },
                (next) => snapshots.push(next),
            ),
        ).toBe(false);
        expect(snapshots).toHaveLength(0);
    });

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
        expect(snapshots).toHaveLength(0);

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
        expect(snapshots).toHaveLength(0);
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
        expect(snapshotCalls).toEqual([]);
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

    it("leaves snapshot publication to admission when entering threshold", () => {
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
        expect(snapshotCalls).toEqual([]);
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
        expect(snapshotCalls).toEqual([undefined]);
    });

    it("fires again and stores the dispatched data length when it changes", () => {
        const onReachedCalls: number[] = [];
        let snapshot: ThresholdSnapshot | undefined;

        const context = baseContext();
        checkThreshold(
            20,
            false,
            50,
            false,
            undefined,
            context,
            (dist) => {
                onReachedCalls.push(dist);
                snapshot = { ...context };
                return true;
            },
            (s) => {
                snapshot = s;
            },
        );
        onReachedCalls.length = 0;

        const changedContext = baseContext({ dataLength: 7 });
        checkThreshold(
            30,
            false,
            50,
            true,
            snapshot,
            changedContext,
            (dist) => {
                onReachedCalls.push(dist);
                snapshot = { ...changedContext };
                return true;
            },
            (s) => {
                snapshot = s;
            },
        );

        expect(onReachedCalls).toEqual([30]);
        expect(snapshot).toEqual(changedContext);
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
                snapshot = { ...context };
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
                snapshot = { ...context };
                return true;
            },
            (s) => {
                snapshot = s;
            },
        );

        expect(onReachedCalls).toEqual([]);
    });

    it("does not dispatch or keep a snapshot while data is empty", () => {
        const snapshots: Array<ThresholdSnapshot | undefined> = [];
        expect(
            checkThreshold(
                0,
                true,
                50,
                true,
                baseContext(),
                baseContext({ dataLength: 0 }),
                () => {
                    throw new Error("empty data");
                },
                (next) => snapshots.push(next),
            ),
        ).toBe(false);
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toBeUndefined();
    });
});
