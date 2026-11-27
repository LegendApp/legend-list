import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import { getStickyPushLimit } from "../../src/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "../../src/constants";
import { IsNewArchitecture } from "../../src/constants-platform";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { useStableRenderComponent } from "../../src/hooks/useStableRenderComponent";
import { peek$, useArr$, useStateContext } from "../../src/state/state";
import { typedMemo } from "../../src/types.internal";
import { getComponent } from "../../src/utils/getComponent";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import TestRenderer, { act } from "../helpers/testRenderer";

let lastLegendListProps: any;
let legendListRenders = 0;

const LegendListMock = React.forwardRef(function LegendListStub(props: any, ref: React.Ref<any>) {
    lastLegendListProps = props;
    legendListRenders++;
    // Attaching the ref triggers AnimatedLegendList's mount-time setLegendList, like the real list.
    React.useImperativeHandle(ref, () => ({}), []);
    return null;
});

function dummyListener() {}

// Mirrors Reanimated's PropsFilter: native worklet handlers become an empty listener per event name.
const createAnimatedComponentMock = (Component: React.ComponentType<any>) =>
    React.forwardRef(function AnimatedComponentStub(props: any, ref) {
        const filtered: Record<string, unknown> = {};
        for (const key in props) {
            const handler = props[key]?.workletEventHandler;
            if (handler) {
                for (const name of handler.eventNames.length > 0 ? handler.eventNames : [key]) {
                    filtered[name] = "listeners" in handler ? handler.listeners[name] : dummyListener;
                }
            } else {
                filtered[key] = props[key];
            }
        }
        return <Component {...filtered} ref={ref} />;
    });

const registerLegendListModuleMock = () =>
    mock.module("@legendapp/list/react-native", () => ({
        internal: {
            getComponent,
            getStickyPushLimit,
            IsNewArchitecture,
            POSITION_OUT_OF_VIEW,
            peek$,
            typedMemo,
            useArr$,
            useCombinedRef,
            useStableRenderComponent,
            useStateContext,
        },
        LegendList: LegendListMock,
    }));

beforeEach(() => {
    lastLegendListProps = undefined;
    legendListRenders = 0;
    registerLegendListModuleMock();
    registerReanimatedModuleMock({ createAnimatedComponent: createAnimatedComponentMock });
});

describe("AnimatedLegendList worklet event handlers", () => {
    it("does not forward Reanimated's placeholder listeners for native worklet handlers to LegendList", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?worklet-events-native");
        const onMomentumScrollEnd = () => {};

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    onMomentumScrollEnd={onMomentumScrollEnd}
                    onScroll={{ workletEventHandler: { eventNames: ["onScroll", "onScrollEndDrag"] } } as any}
                    renderItem={() => null}
                    scrollEventThrottle={16}
                />,
            );
        });

        expect(legendListRenders).toBe(1);
        expect(lastLegendListProps.onScroll).toBeUndefined();
        expect(lastLegendListProps.onScrollEndDrag).toBeUndefined();
        expect(lastLegendListProps.onMomentumScrollEnd).toBe(onMomentumScrollEnd);
        expect(lastLegendListProps.scrollEventThrottle).toBe(16);
    });

    it("keeps JS listeners from web worklet handlers", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?worklet-events-web");
        const listener = () => {};

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    onScroll={
                        { workletEventHandler: { eventNames: ["onScroll"], listeners: { onScroll: listener } } } as any
                    }
                    renderItem={() => null}
                />,
            );
        });

        expect(lastLegendListProps.onScroll).toBe(listener);
    });
});
