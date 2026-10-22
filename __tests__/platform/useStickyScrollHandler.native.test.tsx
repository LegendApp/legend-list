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
                <HookProbe ctx={ctx} onResult={onResult} onScroll={onScroll} stickyHeaderIndices={[0]} />,
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
                <HookProbe ctx={ctx} onResult={onResult} onScroll={onScroll} stickyHeaderIndices={[0]} />,
            );
        });

        expect(animatedEventSpy).toHaveBeenCalledTimes(0);
        expect(result).toBe(onScroll);

        animatedEventSpy.mockRestore();
    });

    it("seeds animatedScrollY from the last native scroll when the handler attaches after mount", () => {
        const onScroll = () => {};
        const onResult = () => {};
        const ctx = createMockContext();
        const setValueSpy = spyOn(ctx.animatedScrollY, "setValue");
        const animatedEventSpy = spyOn(Animated, "event");

        let renderer: ReturnType<typeof TestRenderer.create>;
        act(() => {
            renderer = TestRenderer.create(
                <HookProbe ctx={ctx} onResult={onResult} onScroll={onScroll} stickyHeaderIndices={undefined} />,
            );
        });

        // Nothing has attached Animated.event yet, so the mount-time inset adjustment iOS reports
        // for contentInsetAdjustmentBehavior="automatic" only reaches the plain JS scroll handler.
        expect(animatedEventSpy).toHaveBeenCalledTimes(0);
        expect(setValueSpy).toHaveBeenCalledTimes(0);
        ctx.state.lastNativeScroll = -96;

        act(() => {
            renderer!.update(<HookProbe ctx={ctx} onResult={onResult} onScroll={onScroll} stickyHeaderIndices={[0]} />);
        });

        expect(animatedEventSpy).toHaveBeenCalledTimes(1);
        expect(setValueSpy).toHaveBeenCalledTimes(1);
        expect(setValueSpy).toHaveBeenCalledWith(-96);

        animatedEventSpy.mockRestore();
        setValueSpy.mockRestore();
    });

    it("does not re-seed animatedScrollY while the handler stays attached", () => {
        const onScroll = () => {};
        const onResult = () => {};
        const ctx = createMockContext();
        ctx.state.lastNativeScroll = -96;
        const setValueSpy = spyOn(ctx.animatedScrollY, "setValue");

        let renderer: ReturnType<typeof TestRenderer.create>;
        act(() => {
            renderer = TestRenderer.create(
                <HookProbe ctx={ctx} onResult={onResult} onScroll={onScroll} stickyHeaderIndices={[0]} />,
            );
        });

        expect(setValueSpy).toHaveBeenCalledTimes(1);

        // Animated.event owns the value once attached, so a later indices change must not overwrite
        // it with the JS-tracked offset, which can lag behind during a scroll.
        ctx.state.lastNativeScroll = -40;
        act(() => {
            renderer!.update(
                <HookProbe ctx={ctx} onResult={onResult} onScroll={onScroll} stickyHeaderIndices={[0, 5]} />,
            );
        });

        expect(setValueSpy).toHaveBeenCalledTimes(1);

        setValueSpy.mockRestore();
    });
});
