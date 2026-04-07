import "../setup";

import * as React from "react";
import type { LayoutChangeEvent, LayoutRectangle } from "react-native";

import { describe, expect, it, mock } from "bun:test";
import { useOnLayoutSync } from "../../src/hooks/useOnLayoutSync.native";
import TestRenderer, { act } from "../helpers/testRenderer";

function HookProbe({
    measureLayout,
    onLayoutChange,
    onLayoutProp,
    onResult,
}: {
    measureLayout: LayoutRectangle;
    onLayoutChange: (layout: LayoutRectangle, fromLayoutEffect: boolean) => void;
    onLayoutProp: (event: LayoutChangeEvent) => void;
    onResult: (onLayout: (event: LayoutChangeEvent) => void) => void;
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

describe("useOnLayoutSync.native", () => {
    it("forwards native onLayout even when new-architecture measure already observed the same size", () => {
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
                />,
            );
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutChange).toHaveBeenNthCalledWith(1, measuredLayout, true);
        expect(onLayoutProp).toHaveBeenCalledTimes(0);
        expect(onLayoutHandler).toBeDefined();

        const sameSizeLayoutEvent = { nativeEvent: { layout: { ...measuredLayout } } } as LayoutChangeEvent;

        act(() => {
            onLayoutHandler?.(sameSizeLayoutEvent);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(1);
        expect(onLayoutProp).toHaveBeenCalledTimes(1);
        expect(onLayoutProp).toHaveBeenNthCalledWith(1, sameSizeLayoutEvent);

        const resizedLayout = { ...measuredLayout, width: measuredLayout.width + 5 };
        const resizedLayoutEvent = { nativeEvent: { layout: resizedLayout } } as LayoutChangeEvent;

        act(() => {
            onLayoutHandler?.(resizedLayoutEvent);
        });

        expect(onLayoutChange).toHaveBeenCalledTimes(2);
        expect(onLayoutChange).toHaveBeenNthCalledWith(2, resizedLayout, false);
        expect(onLayoutProp).toHaveBeenCalledTimes(2);
        expect(onLayoutProp).toHaveBeenNthCalledWith(2, resizedLayoutEvent);
    });
});
