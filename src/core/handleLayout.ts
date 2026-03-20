import { calculateItemsInView } from "@/core/calculateItemsInView";
import { doInitialAllocateContainers } from "@/core/doInitialAllocateContainers";
import { doMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { getWindowSize } from "@/platform/getWindowSize";
import type { LayoutRectangle } from "@/platform/scrollview-types";
import { type StateContext, set$ } from "@/state/state";
import { checkThresholds } from "@/utils/checkThresholds";
import { IS_DEV } from "@/utils/devEnvironment";
import { warnDevOnce } from "@/utils/helpers";

export function handleLayout(
    ctx: StateContext,
    layoutParam: LayoutRectangle,
    setCanRender: (canRender: boolean) => void,
) {
    const state = ctx.state;
    const { maintainScrollAtEnd, useWindowScroll } = state.props;
    const scrollAxis = state.props.horizontal ? "width" : "height";
    const otherAxis = state.props.horizontal ? "height" : "width";

    let layout = layoutParam;

    if (useWindowScroll) {
        // In window-scroll mode, keep the scroll axis constrained to the viewport
        // so scrollLength matches what can actually be visible.
        const windowScrollAxisLength = getWindowSize()[scrollAxis];
        layout = windowScrollAxisLength > 0 ? { ...layoutParam, [scrollAxis]: windowScrollAxisLength } : layoutParam;
    }

    // Prefer a positive measured length, but avoid clobbering a previously known
    // non-zero scrollLength with a transient 0 measurement (common on web during
    // initial mount before flex sizing settles).
    const measuredLength = layout[scrollAxis];
    const previousLength = state.scrollLength;
    const scrollLength = measuredLength > 0 ? measuredLength : previousLength;
    const otherAxisSize = layout[otherAxis];
    const previousLayout = state.lastLayout;

    const needsCalculate =
        !previousLayout ||
        scrollLength > state.scrollLength ||
        previousLayout.x !== layout.x ||
        previousLayout.y !== layout.y;

    state.lastLayout = layout;

    const prevOtherAxisSize = state.otherAxisSize;
    const didChange = scrollLength !== state.scrollLength || otherAxisSize !== prevOtherAxisSize;
    if (didChange) {
        state.scrollLength = scrollLength;
        state.otherAxisSize = otherAxisSize;
        state.lastBatchingAction = Date.now();
        state.scrollForNextCalculateItemsInView = undefined;

        if (scrollLength > 0) {
            doInitialAllocateContainers(ctx);
        }

        if (needsCalculate) {
            calculateItemsInView(ctx, { doMVCP: true });
        }
        if (didChange || otherAxisSize !== prevOtherAxisSize) {
            set$(ctx, "scrollSize", { height: layout.height, width: layout.width });
        }

        if (maintainScrollAtEnd?.onLayout) {
            doMaintainScrollAtEnd(ctx);
        }
        checkThresholds(ctx);

        if (state) {
            // If otherAxisSize minus padding is less than 10, we need to set the size of the other axis
            // from the item height. 10 is just a magic number to account for border/outline or rounding errors.
            state.needsOtherAxisSize = otherAxisSize - (state.props.stylePaddingTop || 0) < 10;
        }

        if (IS_DEV && measuredLength === 0) {
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
