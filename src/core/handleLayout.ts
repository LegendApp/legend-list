import type { LayoutRectangle } from "react-native";

import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { type StateContext, set$ } from "@/state/state";
import type { InternalState, MaintainScrollAtEndOptions } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";
import { checkAtTop } from "@/utils/checkAtTop";
import { warnDevOnce } from "@/utils/helpers";
import { updateAlignItemsPaddingTop } from "@/utils/updateAlignItemsPaddingTop";

export function handleLayout(
    ctx: StateContext,
    state: InternalState,
    layout: LayoutRectangle,
    setCanRender: (canRender: boolean) => void,
) {
    const { maintainScrollAtEnd } = state.props;

    // Prefer a positive measured length, but avoid clobbering a previously known
    // non-zero scrollLength with a transient 0 measurement (common on web during
    // initial mount before flex sizing settles).
    const measuredLength = layout[state.props.horizontal ? "width" : "height"];
    const previousLength = state.scrollLength;
    const scrollLength = measuredLength > 0 ? measuredLength : previousLength;
    const otherAxisSize = layout[state.props.horizontal ? "height" : "width"];

    const needsCalculate =
        !state.lastLayout ||
        scrollLength > state.scrollLength ||
        state.lastLayout.x !== layout.x ||
        state.lastLayout.y !== layout.y;

    state.lastLayout = layout;

    const prevOtherAxisSize = state.otherAxisSize;
    const didChange = scrollLength !== state.scrollLength || otherAxisSize !== prevOtherAxisSize;

    if (didChange) {
        state.scrollLength = scrollLength;
        state.otherAxisSize = otherAxisSize;
        state.lastBatchingAction = Date.now();
        state.scrollForNextCalculateItemsInView = undefined;

        if (scrollLength > 0) {
            doInitialAllocateContainers(ctx, state);
        }

        if (needsCalculate) {
            calculateItemsInView(ctx, state, { doMVCP: true });
        }
        if (didChange || otherAxisSize !== prevOtherAxisSize) {
            set$(ctx, "scrollSize", { height: layout.height, width: layout.width });
        }

        if (maintainScrollAtEnd === true || (maintainScrollAtEnd as MaintainScrollAtEndOptions).onLayout) {
            doMaintainScrollAtEnd(ctx, state, true);
        }
        updateAlignItemsPaddingTop(ctx, state);
        checkAtBottom(ctx, state);
        checkAtTop(state);

        if (state) {
            // If otherAxisSize minus padding is less than 10, we need to set the size of the other axis
            // from the item height. 10 is just a magic number to account for border/outline or rounding errors.
            state.needsOtherAxisSize = otherAxisSize - (state.props.stylePaddingTop || 0) < 10;
        }

        if (__DEV__ && measuredLength === 0) {
            warnDevOnce(
                "height0",
                `List ${
                    state.props.horizontal ? "width" : "height"
                } is 0. You may need to set a style or \`flex: \` for the list, because children are absolutely positioned.`,
            );
        }
    }
    setCanRender(true);
}
