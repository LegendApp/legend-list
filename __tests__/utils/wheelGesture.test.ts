import { describe, expect, it } from "bun:test";
import { getWheelGesture, normalizeWheelDelta, type WheelGesture } from "../../src/utils/wheelGesture";

describe("wheel gesture boundaries", () => {
    function stream(events: Array<[number, number, boolean?]>) {
        let previous: WheelGesture | undefined;
        return events.map(([time, delta, momentum]) => {
            const next = getWheelGesture(previous, delta, time, momentum);
            previous = next;
            return next.isNew;
        });
    }
    it("groups constant mouse notches and decaying trackpad frames", () => {
        expect(
            stream([
                [0, 120],
                [50, 120],
                [100, 120],
            ]),
        ).toEqual([true, false, false]);
        expect(stream([40, 30, 22, 16, 11, 8, 5, 3, 2, 1].map((d, i) => [i * 16, d]))).toEqual([
            true,
            ...Array(9).fill(false),
        ]);
    });
    it("starts on gaps over 100ms, reversal, or a clear increase without momentum metadata", () => {
        expect(
            stream([
                [0, 40],
                [80, 30],
                [180, 22],
                [281, 16],
                [297, -11],
                [313, -18],
            ]),
        ).toEqual([true, false, false, true, true, false]);
        expect(
            stream([
                [0, 1],
                [16, 3],
                [32, 4],
                [48, 7],
            ]),
        ).toEqual([true, false, false, false]);
    });
    it("keeps an accelerating swipe and a jittery momentum tail in one gesture", () => {
        for (const deltas of [
            [1, 2, 4, 7, 12, 20, 30, 40],
            [30, 22, 16, 11, 8, 5, 3, 5, 3, 2, 4, 2, 1],
        ]) {
            expect(stream(deltas.map((delta, i) => [i * 16, delta]))).toEqual([
                true,
                ...Array(deltas.length - 1).fill(false),
            ]);
        }
    });
    it("recognizes renewed force after decay and resets the peak for the new gesture", () => {
        expect(stream([40, 30, 10, 20, 12, 5, 10].map((delta, i) => [i * 16, delta]))).toEqual([
            true,
            false,
            false,
            true,
            false,
            false,
            true,
        ]);
        expect(normalizeWheelDelta(1, 2, 0)).toBe(1);
    });
    it("never starts from explicit momentum, even after a gap or reversal", () => {
        expect(
            stream([
                [0, 40, true],
                [200, -50, true],
                [216, -100, true],
                [232, -10, false],
                [248, -40, false],
            ]),
        ).toEqual([false, false, false, true, false]);
    });
    it("normalizes pixel, line and page deltas before comparing increases", () => {
        expect(normalizeWheelDelta(2, 0, 500)).toBe(2);
        expect(normalizeWheelDelta(2, 1, 500)).toBe(32);
        expect(normalizeWheelDelta(2, 2, 500)).toBe(1000);
        expect(
            stream([
                [0, normalizeWheelDelta(1, 1, 500)],
                [16, normalizeWheelDelta(30, 0, 500)],
            ]),
        ).toEqual([true, false]);
    });
});
