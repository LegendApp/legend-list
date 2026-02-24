import "../setup";

import * as React from "react";
import { Animated } from "react-native";

import { describe, expect, it, spyOn } from "bun:test";
import { useStickyScrollHandler } from "../../src/platform/useStickyScrollHandler.native";
import { createMockContext } from "../__mocks__/createMockContext";
import TestRenderer, { act } from "../helpers/testRenderer";

function HookProbe({
    ctx,
    onResult,
    onScroll,
    stickyHeaderIndices,
}: {
    ctx: ReturnType<typeof createMockContext>;
    onResult: (handler: (event: any) => void) => void;
    onScroll: (event: any) => void;
    stickyHeaderIndices?: number[];
}) {
    const handler = useStickyScrollHandler(stickyHeaderIndices, false, ctx, onScroll);

    React.useEffect(() => {
        onResult(handler);
    }, [handler, onResult]);

    return null;
}

describe("useStickyScrollHandler.native", () => {
    it("uses Animated.event for sticky headers in rn-animated mode", () => {
        const onScroll = () => {};
        const onResult = (handler: (event: any) => void) => {
            result = handler;
        };
        const ctx = createMockContext();
        let result: ((event: any) => void) | undefined;
        const animatedEventSpy = spyOn(Animated, "event");

        act(() => {
            TestRenderer.create(
                <HookProbe
                    ctx={ctx}
                    onResult={onResult}
                    onScroll={onScroll}
                    stickyHeaderIndices={[0]}
                />,
            );
        });

        expect(animatedEventSpy).toHaveBeenCalledTimes(1);
        expect(result).toBeDefined();
        expect(result).not.toBe(onScroll);

        animatedEventSpy.mockRestore();
    });

    it("keeps the original onScroll in reanimated mode", () => {
        const onScroll = () => {};
        const onResult = (handler: (event: any) => void) => {
            result = handler;
        };
        const ctx = createMockContext();
        (ctx.state.props as any).stickyPositionComponentInternal = () => null;
        let result: ((event: any) => void) | undefined;
        const animatedEventSpy = spyOn(Animated, "event");

        act(() => {
            TestRenderer.create(
                <HookProbe
                    ctx={ctx}
                    onResult={onResult}
                    onScroll={onScroll}
                    stickyHeaderIndices={[0]}
                />,
            );
        });

        expect(animatedEventSpy).toHaveBeenCalledTimes(0);
        expect(result).toBe(onScroll);

        animatedEventSpy.mockRestore();
    });
});
