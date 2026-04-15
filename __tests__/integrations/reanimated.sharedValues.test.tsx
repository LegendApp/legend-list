import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import { getStickyPushLimit } from "../../src/components/stickyPositionUtils";
import { POSITION_OUT_OF_VIEW } from "../../src/constants";
import { IsNewArchitecture } from "../../src/constants-platform";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { peek$, useArr$, useStateContext } from "../../src/state/state";
import { typedForwardRef, typedMemo } from "../../src/types.internal";
import { getComponent } from "../../src/utils/getComponent";
import TestRenderer, { act } from "../helpers/testRenderer";

type SharedValueMock<T> = {
    get: () => T;
    set: (value: T) => void;
    value: T;
};

let currentLegendListState: {
    activeStickyIndex: number;
    isAtEnd: boolean;
    isAtStart: boolean;
    isNearEnd: boolean;
    isNearStart: boolean;
    isWithinMaintainScrollAtEndThreshold: boolean;
    scroll: number;
};
let lastLegendListProps: any;
let listeners: Map<string, Set<(value: any) => void>>;

const createSharedValueMock = <T,>(initial: T): SharedValueMock<T> => {
    let current = initial;

    return {
        get: () => current,
        set: (value: T) => {
            current = value;
        },
        get value() {
            return current;
        },
        set value(value: T) {
            current = value;
        },
    };
};

const emitLegendListListener = (name: string, value: any) => {
    if (name in currentLegendListState) {
        (currentLegendListState as Record<string, any>)[name] = value;
    }
    for (const listener of listeners.get(name) ?? []) {
        listener(value);
    }
};

const getLegendListState = () => ({
    ...currentLegendListState,
    listen: (name: string, callback: (value: any) => void) => {
        let listenersForName = listeners.get(name);
        if (!listenersForName) {
            listenersForName = new Set();
            listeners.set(name, listenersForName);
        }

        listenersForName.add(callback);
        return () => listenersForName?.delete(callback);
    },
});

const LegendListMock = React.forwardRef(function LegendListStub(props: any, ref: React.Ref<any>) {
    lastLegendListProps = props;
    React.useImperativeHandle(
        ref,
        () => ({
            getState: getLegendListState,
        }),
        [],
    );
    return null;
});

const ReanimatedScrollViewMock = React.forwardRef(function ReanimatedScrollViewStub(props: any, ref: React.Ref<any>) {
    return React.createElement("reanimated-scroll-view", { ...props, ref });
});

const createAnimatedComponentMock = <T extends React.ComponentType<any>>(Component: T): T => Component;
const createReanimatedModuleMock = () => {
    const shared = {
        createAnimatedComponent: createAnimatedComponentMock,
        isWorkletFunction: () => false,
        runOnJS:
            (fn: (...args: any[]) => void) =>
            (...args: any[]) =>
                fn(...args),
        ScrollView: ReanimatedScrollViewMock,
        useAnimatedProps: (updater: () => unknown) => updater,
        useAnimatedRef: () => ({ current: null }),
        useAnimatedScrollHandler: (handler: any) => {
            if (typeof handler === "function") {
                return handler;
            }

            return {
                __invoke: (event: unknown) => handler?.onScroll?.(event),
                workletEventHandler: {},
            };
        },
        useAnimatedStyle: (updater: () => unknown) => updater(),
        useComposedEventHandler: (handlers: any[]) => (event: unknown) => {
            for (const handler of handlers) {
                if (!handler) {
                    continue;
                }

                if (typeof handler === "function") {
                    handler(event);
                    continue;
                }

                if (typeof handler.__invoke === "function") {
                    handler.__invoke(event);
                }
            }
        },
        useScrollViewOffset: () => {},
        useSharedValue: createSharedValueMock,
        View: (props: any) => React.createElement("reanimated-view", props),
    };

    return {
        __esModule: true,
        ...shared,
        default: shared,
    };
};

function registerLegendListModuleMock(isNewArchitecture = IsNewArchitecture) {
    mock.module("@legendapp/list/react-native", () => ({
        internal: {
            getComponent,
            getStickyPushLimit,
            IsNewArchitecture: isNewArchitecture,
            POSITION_OUT_OF_VIEW,
            peek$,
            typedForwardRef,
            typedMemo,
            useArr$,
            useCombinedRef,
            useStateContext,
        },
        LegendList: LegendListMock,
    }));
}

registerLegendListModuleMock();

mock.module("react-native-reanimated", createReanimatedModuleMock);
mock.module("react-native-reanimated/lib/module/index.js", createReanimatedModuleMock);

describe("AnimatedLegendList sharedValues integration", () => {
    beforeEach(() => {
        currentLegendListState = {
            activeStickyIndex: -1,
            isAtEnd: false,
            isAtStart: false,
            isNearEnd: false,
            isNearStart: false,
            isWithinMaintainScrollAtEndThreshold: false,
            scroll: 144,
        };
        lastLegendListProps = undefined;
        listeners = new Map();
        registerLegendListModuleMock();
    });

    it("hydrates semantic shared values, seeds scrollOffset, and forwards it to the bridge", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?shared-values-initial");
        const sharedValues = {
            activeStickyIndex: createSharedValueMock(99),
            isAtEnd: createSharedValueMock(true),
            isAtStart: createSharedValueMock(true),
            isNearEnd: createSharedValueMock(true),
            isNearStart: createSharedValueMock(true),
            isWithinMaintainScrollAtEndThreshold: createSharedValueMock(true),
            scrollOffset: createSharedValueMock(0),
        };

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    renderItem={() => null}
                    sharedValues={sharedValues as any}
                />,
            );
        });

        expect(sharedValues.activeStickyIndex.get()).toBe(-1);
        expect(sharedValues.isAtEnd.get()).toBe(false);
        expect(sharedValues.isAtStart.get()).toBe(false);
        expect(sharedValues.isNearEnd.get()).toBe(false);
        expect(sharedValues.isNearStart.get()).toBe(false);
        expect(sharedValues.isWithinMaintainScrollAtEndThreshold.get()).toBe(false);
        expect(sharedValues.scrollOffset.get()).toBe(144);

        const renderedBridge = lastLegendListProps.renderScrollComponent({
            onScroll: undefined,
            ref: null,
        });
        expect(renderedBridge.props.scrollOffset).toBe(sharedValues.scrollOffset);
    });

    it("updates shared values when legend list listeners fire", async () => {
        const { AnimatedLegendList } = await import("../../src/integrations/reanimated?shared-values-listeners");
        const sharedValues = {
            activeStickyIndex: createSharedValueMock(-1),
            isAtEnd: createSharedValueMock(false),
            isAtStart: createSharedValueMock(false),
            isNearEnd: createSharedValueMock(false),
            isNearStart: createSharedValueMock(false),
            isWithinMaintainScrollAtEndThreshold: createSharedValueMock(false),
        };

        act(() => {
            TestRenderer.create(
                <AnimatedLegendList
                    data={[{ id: "a" }]}
                    estimatedItemSize={10}
                    renderItem={() => null}
                    sharedValues={sharedValues as any}
                />,
            );
        });

        act(() => {
            emitLegendListListener("activeStickyIndex", 4);
            emitLegendListListener("isAtEnd", true);
            emitLegendListListener("isAtStart", true);
            emitLegendListListener("isNearEnd", true);
            emitLegendListListener("isNearStart", true);
            emitLegendListListener("isWithinMaintainScrollAtEndThreshold", true);
        });

        expect(sharedValues.activeStickyIndex.get()).toBe(4);
        expect(sharedValues.isAtEnd.get()).toBe(true);
        expect(sharedValues.isAtStart.get()).toBe(true);
        expect(sharedValues.isNearEnd.get()).toBe(true);
        expect(sharedValues.isNearStart.get()).toBe(true);
        expect(sharedValues.isWithinMaintainScrollAtEndThreshold.get()).toBe(true);
    });
});
