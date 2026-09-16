import { IsNewArchitecture } from "@/constants-platform";
import { peek$, type StateContext, set$ } from "@/state/state";

// Consumes the next parent measurement scope. `undefined` means no request was
// scheduled, `null` means every mounted container, and a Set is a targeted pass.
export function getContainerLayoutEffectScope(ctx: StateContext): Set<number> | null | undefined {
    const scheduledIds = ctx.pendingContainerIds;
    ctx.pendingContainerIds = undefined;
    if (scheduledIds === undefined) {
        return undefined;
    }

    const state = ctx.state;
    let targetContainerIds = scheduledIds;

    if (targetContainerIds && state.userScrollAnchorReset?.keys.size) {
        // A targeted commit must also finish any pending MVCP anchor replacements;
        // otherwise recalculation could use a mix of old and newly measured sizes.
        targetContainerIds = new Set(targetContainerIds);
        for (const itemKey of state.userScrollAnchorReset.keys) {
            const containerId = state.containerItemKeys.get(itemKey);
            if (containerId !== undefined) {
                targetContainerIds.add(containerId);
            }
        }
    }

    return targetContainerIds;
}

export function scheduleContainerLayout(ctx: StateContext, target?: number | ReadonlySet<number>) {
    const isAlreadyScheduled = ctx.pendingContainerIds !== undefined;
    const previousIds = ctx.pendingContainerIds;
    // null represents an all-container request, which must dominate targeted requests
    // added by later child layout effects in the same commit.
    if (target === undefined) {
        ctx.pendingContainerIds = null;
    } else if (previousIds !== null) {
        let nextIds = previousIds;
        if (!nextIds) {
            nextIds = typeof target === "number" ? new Set([target]) : new Set(target);
        } else if (typeof target === "number") {
            nextIds.add(target);
        } else {
            for (const containerId of target) {
                nextIds.add(containerId);
            }
        }
        ctx.pendingContainerIds = nextIds;
    }

    // The first request wakes the parent coordinator. Further requests only extend its
    // pending scope, so a commit with many changed rows still produces one parent pass.
    if (!isAlreadyScheduled) {
        const nextEpoch = (peek$(ctx, "containerLayoutEpoch") ?? 0) + 1;
        set$(ctx, "containerLayoutEpoch", nextEpoch);
    }
}

// Invalidating geometry must also wake mounted rows whose dimensions did not change.
export function triggerMountedContainerLayouts(ctx: StateContext) {
    if (IsNewArchitecture) {
        scheduleContainerLayout(ctx);
    } else {
        for (const triggerLayout of ctx.containerLayoutTriggers.values()) {
            triggerLayout();
        }
    }
}
