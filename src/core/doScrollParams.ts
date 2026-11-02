import { getContentSize } from "@/state/getContentSize";
import type { StateContext } from "@/state/state";
import { toNativeHorizontalOffset } from "@/utils/rtl";

export interface DoScrollToParams {
    animated?: boolean;
    horizontal?: boolean;
    /**
     * Internal adjustment re-assert (old-arch Android workaround). It belongs
     * to the in-flight gesture cycle and must not claim momentum ownership.
     */
    isAdjustment?: boolean;
    isInitialScroll?: boolean;
    offset: number;
}

export function getNativeScrollPoint(ctx: StateContext, offset: number, horizontal = ctx.state.props.horizontal) {
    const { state } = ctx;
    return horizontal
        ? {
              x: toNativeHorizontalOffset(
                  state,
                  offset,
                  Math.max(getContentSize(ctx), state.props.contentContainerMinSize ?? 0),
              ),
              y: 0,
          }
        : { x: 0, y: offset };
}
