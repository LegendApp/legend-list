import { beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import type { ThresholdSnapshot } from "../../src/types";
import { checkThreshold } from "../../src/utils/checkThreshold";

describe("checkThreshold", () => {
    let snapshot: ThresholdSnapshot | undefined;
    let setSnapshotCalls: Array<ThresholdSnapshot | undefined>;
    let onReachedCalls: number[];
    let onReached: (distance: number) => void;
    let setSnapshot: (value: ThresholdSnapshot | undefined) => void;

    const baseContext = () => ({
        scrollPosition: 200,
        contentSize: 1200,
        dataLength: 10,
    });

    beforeEach(() => {
        snapshot = undefined;
        setSnapshotCalls = [];
        onReachedCalls = [];
        onReached = (distance: number) => {
            onReachedCalls.push(distance);
        };
        setSnapshot = (value) => {
            snapshot = value;
            setSnapshotCalls.push(value);
        };
    });

    it("triggers and records a snapshot when entering the threshold window", () => {
        const result = checkThreshold(
            50,
            false,
            100,
            false,
            snapshot,
            baseContext(),
            onReached,
            setSnapshot,
        );

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([50]);
        expect(snapshot).toEqual({
            scrollPosition: 200,
            contentSize: 1200,
            dataLength: 10,
            atThreshold: false,
        });
        expect(setSnapshotCalls.length).toBe(1);
    });

    it("does not trigger again while the snapshot matches the current state", () => {
        checkThreshold(50, false, 100, false, snapshot, baseContext(), onReached, setSnapshot);
        onReachedCalls = [];
        setSnapshotCalls = [];

        const result = checkThreshold(40, false, 100, true, snapshot, baseContext(), onReached, setSnapshot);

        expect(result).toBe(true);
        expect(onReachedCalls.length).toBe(0);
        expect(setSnapshotCalls.length).toBe(0);
    });

    it("resets when distance exceeds hysteresis bounds", () => {
        checkThreshold(50, false, 100, false, snapshot, baseContext(), onReached, setSnapshot);
        onReachedCalls = [];
        setSnapshotCalls = [];

        const result = checkThreshold(150, false, 100, true, snapshot, baseContext(), onReached, setSnapshot);

        expect(result).toBe(false);
        expect(onReachedCalls.length).toBe(0);
        expect(snapshot).toBeUndefined();
        expect(setSnapshotCalls).toEqual([undefined]);
    });

    it("re-triggers when content size changes while still within threshold", () => {
        checkThreshold(50, false, 100, false, snapshot, baseContext(), onReached, setSnapshot);
        onReachedCalls = [];
        setSnapshotCalls = [];

        const result = checkThreshold(
            40,
            false,
            100,
            true,
            snapshot,
            { ...baseContext(), contentSize: 1500 },
            onReached,
            setSnapshot,
        );

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([40]);
        expect(snapshot?.contentSize).toBe(1500);
        expect(setSnapshotCalls.length).toBe(1);
    });

    it("re-triggers when data length changes while still within threshold", () => {
        checkThreshold(50, false, 100, false, snapshot, baseContext(), onReached, setSnapshot);
        onReachedCalls = [];
        setSnapshotCalls = [];

        const result = checkThreshold(
            40,
            false,
            100,
            true,
            snapshot,
            { ...baseContext(), dataLength: 20 },
            onReached,
            setSnapshot,
        );

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([40]);
        expect(snapshot?.dataLength).toBe(20);
        expect(setSnapshotCalls.length).toBe(1);
    });

    it("does not re-trigger when only scroll position changes within threshold", () => {
        checkThreshold(50, false, 100, false, snapshot, baseContext(), onReached, setSnapshot);
        onReachedCalls = [];
        setSnapshotCalls = [];

        const result = checkThreshold(
            40,
            false,
            100,
            true,
            snapshot,
            { ...baseContext(), scrollPosition: 250 },
            onReached,
            setSnapshot,
        );

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([]);
        expect(setSnapshotCalls.length).toBe(0);
    });

    it("records override-triggered snapshots and resets when override clears", () => {
        checkThreshold(200, true, 100, false, snapshot, baseContext(), onReached, setSnapshot);
        expect(snapshot?.atThreshold).toBe(true);

        onReachedCalls = [];
        setSnapshotCalls = [];

        const result = checkThreshold(
            90,
            false,
            100,
            true,
            snapshot,
            baseContext(),
            onReached,
            setSnapshot,
        );

        expect(result).toBe(true);
        expect(onReachedCalls).toEqual([90]);
        expect(snapshot?.atThreshold).toBe(false);
        expect(setSnapshotCalls.length).toBe(1);
    });

    it("does not trigger when threshold is zero and no override is provided", () => {
        const result = checkThreshold(0, false, 0, false, snapshot, baseContext(), onReached, setSnapshot);

        expect(result).toBe(false);
        expect(onReachedCalls.length).toBe(0);
        expect(setSnapshotCalls.length).toBe(0);
    });

    it("propagates errors thrown by onReached", () => {
        const errorSpy = () => {
            throw new Error("boom");
        };

        expect(() =>
            checkThreshold(50, false, 100, false, snapshot, baseContext(), errorSpy, setSnapshot),
        ).toThrow("boom");
    });
});
