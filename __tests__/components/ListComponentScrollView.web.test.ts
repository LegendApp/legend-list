import { describe, expect, it } from "bun:test";
import { createRafCoalescer } from "../../src/utils/createRafCoalescer";

describe("ListComponentScrollView (web)", () => {
    it("coalesces scroll callbacks behind requestAnimationFrame", () => {
        const rafCallbacks: Array<() => void> = [];
        const canceledIds: number[] = [];
        let callbackCount = 0;

        const coalescer = createRafCoalescer(
            () => {
                callbackCount += 1;
            },
            (callback) => {
                rafCallbacks.push(() => callback(0));
                return rafCallbacks.length;
            },
            (id) => {
                canceledIds.push(id);
            },
        );

        expect(coalescer.schedule()).toBe(true);
        expect(coalescer.schedule()).toBe(false);
        expect(rafCallbacks).toHaveLength(1);
        expect(callbackCount).toBe(0);

        rafCallbacks.shift()?.();

        expect(callbackCount).toBe(1);
        expect(coalescer.schedule()).toBe(true);

        coalescer.cancel();

        expect(canceledIds).toEqual([1]);
    });

    it("does not read requestAnimationFrame during creation", () => {
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;

        try {
            // Simulate SSR or a non-DOM render environment where RAF is unavailable.
            delete (globalThis as typeof globalThis & { requestAnimationFrame?: typeof requestAnimationFrame })
                .requestAnimationFrame;
            delete (globalThis as typeof globalThis & { cancelAnimationFrame?: typeof cancelAnimationFrame })
                .cancelAnimationFrame;

            expect(() => createRafCoalescer(() => undefined)).not.toThrow();
        } finally {
            globalThis.requestAnimationFrame = originalRaf;
            globalThis.cancelAnimationFrame = originalCancelRaf;
        }
    });
});
