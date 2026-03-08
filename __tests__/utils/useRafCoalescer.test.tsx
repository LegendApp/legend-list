import "../setup";

import * as React from "react";

import { describe, expect, it } from "bun:test";
import { useRafCoalescer } from "../../src/utils/useRafCoalescer";
import TestRenderer, { act } from "../helpers/testRenderer";

function HookProbe({
    callback,
    onCoalescer,
}: {
    callback: () => void;
    onCoalescer: (coalescer: ReturnType<typeof useRafCoalescer>) => void;
}) {
    const coalescer = useRafCoalescer(callback);

    React.useEffect(() => {
        onCoalescer(coalescer);
    });

    return null;
}

describe("useRafCoalescer", () => {
    it("coalesces repeated schedule calls behind requestAnimationFrame", () => {
        const rafCallbacks: Array<() => void> = [];
        const canceledIds: number[] = [];
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancelRaf = globalThis.cancelAnimationFrame;
        let callbackCount = 0;
        let coalescer: ReturnType<typeof useRafCoalescer> | undefined;
        let renderer: TestRenderer.ReactTestRenderer | undefined;

        try {
            globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
                rafCallbacks.push(() => callback(0));
                return rafCallbacks.length;
            }) as typeof requestAnimationFrame;
            globalThis.cancelAnimationFrame = ((id: number) => {
                canceledIds.push(id);
            }) as typeof cancelAnimationFrame;

            act(() => {
                renderer = TestRenderer.create(
                    <HookProbe
                        callback={() => {
                            callbackCount += 1;
                        }}
                        onCoalescer={(value) => {
                            coalescer = value;
                        }}
                    />,
                );
            });

            expect(coalescer).toBeDefined();
            expect(coalescer?.schedule()).toBe(true);
            expect(coalescer?.schedule()).toBe(false);
            expect(rafCallbacks).toHaveLength(1);
            expect(callbackCount).toBe(0);

            rafCallbacks.shift()?.();

            expect(callbackCount).toBe(1);
            expect(coalescer?.schedule()).toBe(true);

            coalescer?.cancel();

            expect(canceledIds).toEqual([1]);
        } finally {
            act(() => {
                renderer?.unmount();
            });
            globalThis.requestAnimationFrame = originalRaf;
            globalThis.cancelAnimationFrame = originalCancelRaf;
        }
    });

    it("uses the latest callback without recreating the coalescer", () => {
        const rafCallbacks: Array<() => void> = [];
        const originalRaf = globalThis.requestAnimationFrame;
        let coalescer: ReturnType<typeof useRafCoalescer> | undefined;
        let renderer: TestRenderer.ReactTestRenderer | undefined;
        let callbackValue = "first";
        const callbackCalls: string[] = [];

        try {
            globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
                rafCallbacks.push(() => callback(0));
                return rafCallbacks.length;
            }) as typeof requestAnimationFrame;

            const handleCoalescer = (value: ReturnType<typeof useRafCoalescer>) => {
                coalescer = value;
            };

            act(() => {
                renderer = TestRenderer.create(
                    <HookProbe
                        callback={() => {
                            callbackCalls.push(callbackValue);
                        }}
                        onCoalescer={handleCoalescer}
                    />,
                );
            });

            const firstCoalescer = coalescer;

            expect(coalescer?.schedule()).toBe(true);

            callbackValue = "second";

            act(() => {
                renderer?.update(
                    <HookProbe
                        callback={() => {
                            callbackCalls.push(callbackValue);
                        }}
                        onCoalescer={handleCoalescer}
                    />,
                );
            });

            expect(coalescer).toBe(firstCoalescer);

            rafCallbacks.shift()?.();

            expect(callbackCalls).toEqual(["second"]);
        } finally {
            act(() => {
                renderer?.unmount();
            });
            globalThis.requestAnimationFrame = originalRaf;
        }
    });
});
