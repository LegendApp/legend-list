import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types.internal";
import { createMockState, DEFAULT_CONTENT_INSET } from "./createMockState";

// Create a properly typed mock context
export function createMockContext(
    initialValues: Record<string, any> = {},
    stateOverrides?: Parameters<typeof createMockState>[0],
): StateContext {
    const state = createMockState(stateOverrides) as InternalState & {
        activeStickyIndex?: number;
        isAtEnd?: boolean;
        isAtStart?: boolean;
    };
    const defaults: Record<string, any> = {
        activeStickyIndex: state.activeStickyIndex ?? -1,
        contentInset: DEFAULT_CONTENT_INSET,
        isAtEnd: state.isAtEnd ?? false,
        isAtStart: state.isAtStart ?? false,
        scrollAdjust: 0,
        scrollAdjustPending: 0,
        scrollAdjustUserOffset: 0,
        scrollingTo: undefined,
    };
    const values = new Map(Object.entries({ ...defaults, ...initialValues })) as StateContext["values"];
    const listeners = new Map() as StateContext["listeners"];
    const animatedScrollY = { setValue: () => undefined } as unknown as StateContext["animatedScrollY"];

    Object.defineProperty(state, "activeStickyIndex", {
        configurable: true,
        enumerable: true,
        get: () => values.get("activeStickyIndex"),
        set: (value) => {
            values.set("activeStickyIndex", value);
        },
    });
    Object.defineProperty(state, "isAtEnd", {
        configurable: true,
        enumerable: true,
        get: () => values.get("isAtEnd"),
        set: (value) => {
            values.set("isAtEnd", value);
        },
    });
    Object.defineProperty(state, "isAtStart", {
        configurable: true,
        enumerable: true,
        get: () => values.get("isAtStart"),
        set: (value) => {
            values.set("isAtStart", value);
        },
    });

    return {
        animatedScrollY,
        columnWrapperStyle: undefined,
        listeners,
        mapViewabilityAmountCallbacks: new Map() as StateContext["mapViewabilityAmountCallbacks"],
        mapViewabilityAmountValues: new Map() as StateContext["mapViewabilityAmountValues"],
        mapViewabilityCallbacks: new Map() as StateContext["mapViewabilityCallbacks"],
        mapViewabilityConfigStates: new Map() as StateContext["mapViewabilityConfigStates"],
        mapViewabilityValues: new Map() as StateContext["mapViewabilityValues"],
        positionListeners: new Map(),
        state,
        values,
        viewRefs: new Map() as StateContext["viewRefs"],
    };
}
