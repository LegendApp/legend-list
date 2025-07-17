import { calculateItemsInView } from "./calculateItemsInView";
import { checkAtBottom } from "./checkAtBottom";
import { checkAtTop } from "./checkAtTop";
import { doInitialAllocateContainers } from "./doInitialAllocateContainers";
import { doMaintainScrollAtEnd } from "./doMaintainScrollAtEnd";
import { warnDevOnce } from "./helpers";
import { type StateContext, set$ } from "./state";
import type { InternalState, MaintainScrollAtEndOptions } from "./types";
import { updateAlignItemsPaddingTop } from "./updateAlignItemsPaddingTop";

export function handleLayout(
    ctx: StateContext,
    state: InternalState,
    size: { width: number; height: number },
    setCanRender: (canRender: boolean) => void,
) {
    const { maintainScrollAtEnd } = state.props;

    const scrollLength = size[state.props.horizontal ? "width" : "height"];
    const otherAxisSize = size[state.props.horizontal ? "height" : "width"];

    const didChange = scrollLength !== state.scrollLength;
    const prevOtherAxisSize = state.otherAxisSize;
    state.scrollLength = scrollLength;
    state.otherAxisSize = otherAxisSize;
    state.lastBatchingAction = Date.now();
    state.scrollForNextCalculateItemsInView = undefined;

    doInitialAllocateContainers(ctx, state);

    if (didChange) {
        calculateItemsInView(ctx, state, { doMVCP: true });
    }
    if (didChange || otherAxisSize !== prevOtherAxisSize) {
        set$(ctx, "scrollSize", { width: size.width, height: size.height });
    }

    if (maintainScrollAtEnd === true || (maintainScrollAtEnd as MaintainScrollAtEndOptions).onLayout) {
        doMaintainScrollAtEnd(ctx, state, false);
    }
    updateAlignItemsPaddingTop(ctx, state);
    checkAtBottom(ctx, state);
    checkAtTop(state);

    if (state) {
        // If otherAxisSize minus padding is less than 10, we need to set the size of the other axis
        // from the item height. 10 is just a magic number to account for border/outline or rounding errors.
        state.needsOtherAxisSize = otherAxisSize - (state.props.stylePaddingTop || 0) < 10;
    }

    if (__DEV__ && scrollLength === 0) {
        warnDevOnce(
            "height0",
            `List ${
                state.props.horizontal ? "width" : "height"
            } is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
        );
    }

    calculateItemsInView(ctx, state, { doMVCP: true });

    setCanRender(true);
}
