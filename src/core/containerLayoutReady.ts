import { type StateContext, set$ } from "@/state/state";

const CONTAINER_LAYOUT_READY_PREFIX = "containerLayoutReady";

// Clears the hide-until-measured signal on every container that has one. Only opted-in lists
// publish it, so a list that opts back out could otherwise strand a container at `false` with
// nothing left running to reveal it. Position components treat `undefined` as ready.
//
// This walks the published signals rather than a container count because the count can lag
// behind the containers that were actually written to. Only reassigning existing keys, so
// iterating while setting is safe.
export function resetContainerLayoutReady(ctx: StateContext) {
    for (const signalName of ctx.values.keys()) {
        if (signalName.startsWith(CONTAINER_LAYOUT_READY_PREFIX)) {
            set$(ctx, signalName as `containerLayoutReady${number}`, undefined);
        }
    }
}
