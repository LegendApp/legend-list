import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";

// Create a properly typed mock context
export function createMockContext(initialValues: Record<string, any> = {}): StateContext {
    const defaults: Record<string, any> = {
        scrollAdjust: 0,
        scrollAdjustPending: 0,
        scrollAdjustUserOffset: 0,
        scrollingTo: undefined,
    };
    const values = new Map(Object.entries({ ...defaults, ...initialValues })) as StateContext["values"];
    const listeners = new Map() as StateContext["listeners"];
    const animatedScrollY = { setValue: () => undefined } as unknown as StateContext["animatedScrollY"];

    return {
        animatedScrollY,
        columnWrapperStyle: undefined,
        internalState: undefined,
        listeners,
        mapViewabilityAmountCallbacks: new Map() as StateContext["mapViewabilityAmountCallbacks"],
        mapViewabilityAmountValues: new Map() as StateContext["mapViewabilityAmountValues"],
        mapViewabilityCallbacks: new Map() as StateContext["mapViewabilityCallbacks"],
        mapViewabilityConfigStates: new Map() as StateContext["mapViewabilityConfigStates"],
        mapViewabilityValues: new Map() as StateContext["mapViewabilityValues"],
        values,
        viewRefs: new Map() as StateContext["viewRefs"],
    };
}
