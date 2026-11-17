import "../setup";

import * as React from "react";
import { Animated } from "react-native";

import { describe, expect, it, mock, spyOn } from "bun:test";
import type { LooseScrollView } from "../../src/platform/scrollview-types";
import { useStickyScrollHandler } from "../../src/platform/useStickyScrollHandler.native";
import { createMockContext } from "../__mocks__/createMockContext";
import TestRenderer, { act } from "../helpers/testRenderer";

function mountProbe(stableHandle = false) {
    const ctx = createMockContext();
    ctx.state.props.data = [0, 1, 2];
    const onScroll = mock((_event: any) => {});
    const forwardedRef = mock((_view: LooseScrollView | null) => {});
    const detachments: ReturnType<typeof mock>[] = [];
    const attach = spyOn(Animated, "attachNativeEvent").mockImplementation(() => {
        const detach = mock(() => {});
        detachments.push(detach);
        return { detach };
    });
    const animatedEvent = spyOn(Animated, "event");
    let result: ReturnType<typeof useStickyScrollHandler>;
    let replaceNativeView: () => void;
    const targets = [{ id: "first" }, { id: "second" }];

    function CustomScroller({ forwarded }: { forwarded: React.RefCallback<LooseScrollView | null> }) {
        const [generation, setGeneration] = React.useState(0);
        replaceNativeView = () => setGeneration(1);
        const view = React.useMemo(
            () => ({ getScrollableNode: () => targets[generation] }) as unknown as LooseScrollView,
            [generation],
        );
        const currentView = React.useRef(view);
        currentView.current = view;
        const stableView = React.useMemo(
            () => ({ getScrollableNode: () => currentView.current.getScrollableNode() }) as LooseScrollView,
            [],
        );
        const exposedView = stableHandle ? stableView : view;
        React.useImperativeHandle(forwarded, () => exposedView, [exposedView]);
        return null;
    }

    type Props = { indices?: number[]; horizontal?: boolean };
    function Probe({ indices = [0], horizontal = false }: Props) {
        result = useStickyScrollHandler(indices, horizontal, ctx, onScroll, forwardedRef);
        return <CustomScroller forwarded={result.refScrollView} />;
    }
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(<Probe />);
    });
    return {
        animatedEvent,
        attach,
        ctx,
        detachments,
        forwardedRef,
        onScroll,
        replaceNativeView: () => act(async () => replaceNativeView()),
        replaceNativeViewSync: () => act(() => replaceNativeView()),
        get result() {
            return result!;
        },
        targets,
        unmount: () => act(() => renderer.unmount()),
        update: (props: Props) => act(() => renderer.update(<Probe {...props} />)),
    };
}

describe("useStickyScrollHandler.native", () => {
    it("drives sticky transforms without observing the value and forwards scroll events", () => {
        const probe = mountProbe();
        try {
            expect(probe.animatedEvent).not.toHaveBeenCalled();
            expect(typeof probe.result.onScroll).toBe("function");
            expect(probe.attach).toHaveBeenCalledWith(probe.targets[0], "onScroll", [
                { nativeEvent: { contentOffset: { y: probe.ctx.animatedScrollY } } },
            ]);
            const event = { nativeEvent: { contentOffset: { y: 240 } } };
            probe.result.onScroll(event as any);
            expect(probe.onScroll).toHaveBeenCalledWith(event);
        } finally {
            probe.unmount();
        }
        expect(probe.detachments.every((detach) => detach.mock.calls.length === 1)).toBe(true);
    });

    it("rebinds and forwards the ref when a custom scroller replaces its native view in its own commit", async () => {
        const probe = mountProbe();
        try {
            const firstAttachment = probe.detachments.at(-1)!;
            const ref = probe.result.refScrollView;
            await probe.replaceNativeView();
            expect(firstAttachment).toHaveBeenCalledTimes(1);
            expect(probe.attach).toHaveBeenLastCalledWith(probe.targets[1], "onScroll", [
                { nativeEvent: { contentOffset: { y: probe.ctx.animatedScrollY } } },
            ]);
            expect(probe.result.refScrollView).toBe(ref);
            expect(probe.forwardedRef.mock.calls.map(([view]) => view?.getScrollableNode() ?? null)).toEqual([
                probe.targets[0],
                null,
                probe.targets[1],
            ]);
        } finally {
            probe.unmount();
        }
        expect(probe.forwardedRef).toHaveBeenLastCalledWith(null);
        expect(probe.detachments.every((detach) => detach.mock.calls.length === 1)).toBe(true);
    });

    it("rebinds the same value after sticky/data changes and switches the native axis", () => {
        const probe = mountProbe();
        try {
            const value = probe.ctx.animatedScrollY;
            probe.update({ indices: [1, 2] });
            expect(probe.ctx.animatedScrollY).toBe(value);
            expect(probe.attach).toHaveBeenCalledTimes(2);
            probe.ctx.state.props.data = [];
            probe.update({ indices: [0] });
            expect(probe.attach).toHaveBeenCalledTimes(2);
            expect(probe.detachments[1]).toHaveBeenCalledTimes(1);
            probe.ctx.state.props.data = [0, 1, 2];
            probe.update({ horizontal: true, indices: [0] });
            expect(probe.attach).toHaveBeenLastCalledWith(probe.targets[0], "onScroll", [
                { nativeEvent: { contentOffset: { x: value } } },
            ]);
            probe.update({ indices: [] });
            expect(probe.detachments[2]).toHaveBeenCalledTimes(1);
        } finally {
            probe.unmount();
        }
    });

    it("leaves invalid stickies and the Reanimated engine without a native attachment", () => {
        const probe = mountProbe();
        try {
            probe.update({ indices: [-1, 3] });
            expect(probe.detachments[0]).toHaveBeenCalledTimes(1);
            expect(probe.attach).toHaveBeenCalledTimes(1);
            probe.ctx.state.props.stickyPositionComponentInternal = () => null;
            probe.update({ indices: [0] });
            expect(probe.attach).toHaveBeenCalledTimes(1);
            expect(probe.result.onScroll).toBe(probe.onScroll);
        } finally {
            probe.unmount();
        }
    });

    it.each([false, true])(
        "follows an inner native replacement behind a stable handle (horizontal %s)",
        async (horizontal) => {
            const probe = mountProbe(true);
            const setValue = spyOn(probe.ctx.animatedScrollY, "setValue");
            try {
                probe.update({ horizontal });
                const firstAttachment = probe.detachments.at(-1)!;
                const initialAttachments = probe.attach.mock.calls.length;
                await probe.replaceNativeView();
                // The wrapper's public ref stays mounted while its inner target changes.
                expect(probe.forwardedRef).toHaveBeenCalledTimes(1);
                expect(probe.attach).toHaveBeenCalledTimes(initialAttachments);
                const event = { nativeEvent: { contentOffset: { x: 320, y: 900 } } };
                probe.result.onScroll(event as any);
                expect(firstAttachment).toHaveBeenCalledTimes(1);
                expect(probe.attach).toHaveBeenLastCalledWith(probe.targets[1], "onScroll", [
                    { nativeEvent: { contentOffset: { [horizontal ? "x" : "y"]: probe.ctx.animatedScrollY } } },
                ]);
                expect(setValue).toHaveBeenCalledWith(horizontal ? 320 : 900);
                expect(probe.onScroll).toHaveBeenCalledWith(event);
                expect(probe.onScroll).toHaveBeenCalledTimes(1);
                probe.result.onScroll(event as any);
                expect(probe.attach).toHaveBeenCalledTimes(initialAttachments + 1);
                expect(setValue).toHaveBeenCalledTimes(1);
                expect(probe.onScroll).toHaveBeenCalledTimes(2);
            } finally {
                probe.unmount();
            }
            expect(probe.detachments.every((detach) => detach.mock.calls.length === 1)).toBe(true);
        },
    );

    it("cancels a pending native-view attachment when the list unmounts", async () => {
        const probe = mountProbe();
        const initialCount = probe.attach.mock.calls.length;
        probe.replaceNativeViewSync();
        expect(probe.forwardedRef.mock.calls.at(-1)?.[0]?.getScrollableNode()).toBe(probe.targets[1]);
        probe.unmount();
        await Promise.resolve();
        expect(probe.attach).toHaveBeenCalledTimes(initialCount);
        expect(probe.detachments.every((detach) => detach.mock.calls.length === 1)).toBe(true);
        expect(probe.forwardedRef).toHaveBeenLastCalledWith(null);
    });
});
