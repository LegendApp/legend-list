import "../setup"; // Import global test setup

import type { StateContext } from "../../src/state/state";
import type { InternalState } from "../../src/types";
import { requestAdjust } from "../../src/utils/requestAdjust";
import { createMockState, DEFAULT_CONTENT_INSET } from "./createMockState";

// Create a properly typed mock context
export function createMockContext(
    initialValues: Record<string, any> = {},
    stateOverrides?: Parameters<typeof createMockState>[0],
): StateContext {
    const defaults: Record<string, any> = {
        contentInset: DEFAULT_CONTENT_INSET,
        deferredPositionVisualAdjust: 0,
        scrollAdjust: 0,
        scrollAdjustPending: 0,
        scrollAdjustUserOffset: 0,
        scrollingTo: undefined,
    };
    const values = new Map(Object.entries({ ...defaults, ...initialValues })) as StateContext["values"];
    const listeners = new Map() as StateContext["listeners"];
    const animatedScrollY = { setValue: () => undefined } as unknown as StateContext["animatedScrollY"];
    const ctx = {
        animatedScrollY,
        columnWrapperStyle: undefined,
        listeners,
        mapViewabilityAmountCallbacks: new Map() as StateContext["mapViewabilityAmountCallbacks"],
        mapViewabilityAmountValues: new Map() as StateContext["mapViewabilityAmountValues"],
        mapViewabilityCallbacks: new Map() as StateContext["mapViewabilityCallbacks"],
        mapViewabilityConfigStates: new Map() as StateContext["mapViewabilityConfigStates"],
        mapViewabilityValues: new Map() as StateContext["mapViewabilityValues"],
        positionListeners: new Map(),
        runRequestAdjust: (positionDiff: number, dataChanged?: boolean) => requestAdjust(ctx, positionDiff, dataChanged),
        runUpdateScroll: () => undefined,
        state: createMockState(stateOverrides) as InternalState,
        values,
        viewRefs: new Map() as StateContext["viewRefs"],
    } satisfies StateContext;

    return ctx;
}
