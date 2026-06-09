import "../setup";

import * as React from "react";
import type { LayoutChangeEvent, LayoutRectangle } from "react-native";

import { describe, expect, it, mock } from "bun:test";
import TestRenderer, { act } from "../helpers/testRenderer";

function HookProbe({
    measureLayout,
    onLayoutChange,
    onLayoutProp,
    onResult,
    useOnLayoutSync,
}: {
    measureLayout: LayoutRectangle;
    onLayoutChange: (layout: LayoutRectangle, fromLayoutEffect: boolean) => void;
    onLayoutProp: (event: LayoutChangeEvent) => void;
    onResult: (onLayout: (event: LayoutChangeEvent) => void) => void;
    useOnLayoutSync: typeof import("../../src/hooks/useOnLayoutSync.native").useOnLayoutSync;
}) {
    const ref = React.useRef({
        measure: (callback: (x: number, y: number, width: number, height: number) => void) => {
            callback(measureLayout.x, measureLayout.y, measureLayout.width, measureLayout.height);
        },
    });
    const { onLayout } = useOnLayoutSync({ onLayoutChange, onLayoutProp, ref });

    React.useEffect(() => {
        onResult(onLayout);
    }, [onLayout, onResult]);

    return null;
}

async function importNewArchitectureUseOnLayoutSync() {
    mock.module("@/constants-platform", () => ({
        IsNewArchitecture: true,
    }));

    return import("../../src/hooks/useOnLayoutSync.native?use-on-layout-sync-native-new-arch");
}

describe("useOnLayoutSync.native", () => {
    it("forwards native onLayout while only re-running layout sync for changed sizes", async () => {
        const { useOnLayoutSync } = await importNewArchitectureUseOnLayoutSync();
        const measuredLayout = { height: 240, width: 120, x: 4, y: 8 };
        const onLayoutChange = mock<(layout: LayoutRectangle, fromLayoutEffect: boolean) => void>();
        const onLayoutProp = mock<(event: LayoutChangeEvent) => void>();
        let onLayoutHandler: ((event: LayoutChangeEvent) => void) | undefined;

        act(() => {
            TestRenderer.create(
                <HookProbe
                    measureLayout={measuredLayout}
                    onLayoutChange={onLayoutChange}
                    onLayoutProp={onLayoutProp}
                    onResult={(onLayout) => {
                        onLayoutHandler = onLayout;
                    }}
                    useOnLayoutSync={useOnLayoutSync}
                />,
            );
        });

        expect(onLayoutProp).toHaveBeenCalledTimes(0);
        expect(onLayoutHandler).toBeDefined();
        const baselineOnLayoutChangeCalls = onLayoutChange.mock.calls.length;

        const sameSizeLayoutEvent = { nativeEvent: { layout: { ...measuredLayout } } } as LayoutChangeEvent;

        act(() => {
            onLayoutHandler?.(sameSizeLayoutEvent);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(baselineOnLayoutChangeCalls);
        expect(onLayoutProp).toHaveBeenCalledTimes(1);
        expect(onLayoutProp).toHaveBeenNthCalledWith(1, sameSizeLayoutEvent);

        act(() => {
            onLayoutHandler?.(sameSizeLayoutEvent);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(baselineOnLayoutChangeCalls);
        expect(onLayoutProp).toHaveBeenCalledTimes(2);
        expect(onLayoutProp).toHaveBeenNthCalledWith(2, sameSizeLayoutEvent);

        const resizedLayout = { ...measuredLayout, width: measuredLayout.width + 5 };
        const resizedLayoutEvent = { nativeEvent: { layout: resizedLayout } } as LayoutChangeEvent;

        act(() => {
            onLayoutHandler?.(resizedLayoutEvent);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(baselineOnLayoutChangeCalls + 1);
        expect(onLayoutChange).toHaveBeenNthCalledWith(baselineOnLayoutChangeCalls + 1, resizedLayout, false);
        expect(onLayoutProp).toHaveBeenCalledTimes(3);
        expect(onLayoutProp).toHaveBeenNthCalledWith(3, resizedLayoutEvent);
    });

    it("ignores one-physical-pixel native onLayout noise after Fabric measure", async () => {
        const { useOnLayoutSync } = await importNewArchitectureUseOnLayoutSync();
        const measuredLayout = { height: 120.6669921875, width: 402, x: 0, y: 0 };
        const onLayoutChange = mock<(layout: LayoutRectangle, fromLayoutEffect: boolean) => void>();
        const onLayoutProp = mock<(event: LayoutChangeEvent) => void>();
        let onLayoutHandler: ((event: LayoutChangeEvent) => void) | undefined;

        act(() => {
            TestRenderer.create(
                <HookProbe
                    measureLayout={measuredLayout}
                    onLayoutChange={onLayoutChange}
                    onLayoutProp={onLayoutProp}
                    onResult={(onLayout) => {
                        onLayoutHandler = onLayout;
                    }}
                    useOnLayoutSync={useOnLayoutSync}
                />,
            );
        });

        const baselineOnLayoutChangeCalls = onLayoutChange.mock.calls.length;
        const nativeNoiseLayout = { ...measuredLayout, height: 120.333984375 };
        const dispatchLayout = (layout: LayoutRectangle) => {
            act(() => {
                onLayoutHandler?.({ nativeEvent: { layout } } as LayoutChangeEvent);
            });
        };

        dispatchLayout(nativeNoiseLayout);
        dispatchLayout(nativeNoiseLayout);
        dispatchLayout(measuredLayout);
        dispatchLayout(nativeNoiseLayout);
        expect(onLayoutChange).toHaveBeenCalledTimes(baselineOnLayoutChangeCalls);
        expect(onLayoutProp).toHaveBeenCalledTimes(4);

        const resizedLayout = { ...nativeNoiseLayout, height: nativeNoiseLayout.height - 1 };

        dispatchLayout(resizedLayout);
        expect(onLayoutChange).toHaveBeenCalledTimes(baselineOnLayoutChangeCalls + 1);
        expect(onLayoutChange).toHaveBeenNthCalledWith(baselineOnLayoutChangeCalls + 1, resizedLayout, false);
        expect(onLayoutProp).toHaveBeenCalledTimes(5);
    });
});
