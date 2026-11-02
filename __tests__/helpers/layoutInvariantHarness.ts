import type { ListCtx } from "../../examples-shared/layoutInvariants";

// Loaded lazily: the checker imports src modules, which must not load before setup registers
// the native module mocks.
const invariants = () =>
    require("../../examples-shared/layoutInvariants") as typeof import("../../examples-shared/layoutInvariants");

// Every LegendList mounted by a test registers here (dev hook in useDevChecks). The act()
// wrappers in testRenderer/testingLibrary check the layout invariants after each act.
const liveLists = new Set<ListCtx>();
let enabled = true;

export function installLayoutInvariantHarness() {
    invariants().installListRegistry(liveLists);
}

/** Forget lists from the previous test (renderers a test did not unmount stay mounted). */
export function resetLayoutInvariantHarness() {
    liveLists.clear();
    enabled = true;
}

/** Opt a test out of the automatic checks, e.g. when it builds deliberately inconsistent state. */
export function skipLayoutInvariants() {
    enabled = false;
}

export function assertLayoutInvariants(lists: Iterable<ListCtx> = liveLists) {
    for (const ctx of lists) {
        const { checkLayoutInvariants, describeListState } = invariants();
        const violations = checkLayoutInvariants(ctx, { containerPositions: true });
        if (violations.length) {
            throw new Error(
                `Layout invariant violated: ${JSON.stringify(violations.slice(0, 3))} (${describeListState(ctx)})`,
            );
        }
    }
}

export function withLayoutInvariants<T extends (callback: any) => any>(act: T): T {
    return ((callback: () => unknown) => {
        let isAsync = false;
        const result = act(() => {
            const value = callback();
            isAsync = !!value && typeof (value as PromiseLike<unknown>).then === "function";
            return value;
        });
        const check = () => {
            if (enabled) assertLayoutInvariants();
        };
        if (isAsync) {
            // act() returns a non-chainable thenable.
            return Promise.resolve(result).then((value: unknown) => {
                check();
                return value;
            });
        }
        check();
        return result;
    }) as T;
}
