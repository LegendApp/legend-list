import { IsNewArchitecture } from "@/constants-platform";
import { getContentSize } from "@/state/getContentSize";
import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";
import { getItemSize } from "@/utils/getItemSize";
import { requestAdjust } from "@/utils/requestAdjust";

export function prepareMVCP(ctx: StateContext, dataChanged?: boolean): (() => void) | undefined {
    const state = ctx.state!;
    const { idsInView, positions, props } = state;
    const { maintainVisibleContentPosition } = props;
    const scrollingTo = peek$(ctx, "scrollingTo");

    let prevPosition: number | undefined;
    let prevSize: number | undefined;
    let targetId: string | undefined;
    const idsInViewWithPositions: { id: string; position: number }[] = [];
    const scrollTarget = scrollingTo?.index;
    const scrollingToViewPosition = scrollingTo?.viewPosition;

    const shouldMVCP = !dataChanged || maintainVisibleContentPosition;
    const indexByKey = state.indexByKey;

    // If scrollingTo with a viewPosition > 0, we need to also adjust by the size difference of the target
    // item based on viewPosition
    if (scrollTarget !== undefined && scrollingToViewPosition !== undefined && scrollingToViewPosition > 0) {
        prevSize = getItemSize(ctx, getId(state, scrollTarget), scrollTarget, state.props.data[scrollTarget!]);
    }

    if (shouldMVCP) {
        if (scrollTarget !== undefined) {
            if (!IsNewArchitecture && scrollingTo?.isInitialScroll) {
                // In old architecture, we don't want to do MVCP for the initial scroll
                // because it can cause inaccuracy
                return undefined;
            }
            // If we're currently scrolling to a target index, do MVCP for its position
            targetId = getId(state, scrollTarget);
        } else if (idsInView.length > 0 && peek$(ctx, "containersDidLayout")) {
            if (dataChanged) {
                // Do MVCP for the first item fully in view
                for (let i = 0; i < idsInView.length; i++) {
                    const id = idsInView[i];
                    const index = indexByKey.get(id);
                    if (index !== undefined) {
                        idsInViewWithPositions.push({ id, position: positions.get(id)! });
                    }
                }
            } else {
                // Do MVCP for the first item fully in view
                targetId = idsInView.find((id) => indexByKey.get(id) !== undefined);
            }
        }

        if (targetId !== undefined) {
            prevPosition = positions.get(targetId)!;
        }

        // Return a function to do MVCP based on the prepared values
        return () => {
            let positionDiff: number | undefined;

            // If data changed then we need to find the first item fully in view
            // which was exists in the new data
            if (dataChanged && targetId === undefined && maintainVisibleContentPosition) {
                for (let i = 0; i < idsInViewWithPositions.length; i++) {
                    const { id, position } = idsInViewWithPositions[i];
                    const newPosition = positions.get(id);
                    if (newPosition !== undefined) {
                        positionDiff = newPosition - position;
                        break;
                    }
                }
            }

            // If we have a targetId, then we can use the previous position of that item
            if (targetId !== undefined && prevPosition !== undefined) {
                const newPosition = positions.get(targetId);

                if (newPosition !== undefined) {
                    const totalSize = getContentSize(ctx);
                    let diff = newPosition - prevPosition;
                    if (diff !== 0 && state.scroll + state.scrollLength > totalSize) {
                        // If we're scrolling to the end of the list, then there's two potential issues we workaround:
                        // 1. List items above the scroll target may be in view so we don't want to take too much adjusting
                        // 2. Adjusting too much could cause the list to scroll back up
                        if (diff > 0) {
                            diff = Math.max(0, totalSize - state.scroll - state.scrollLength);
                        } else {
                            diff = 0;
                        }
                    }

                    positionDiff = diff;
                }
            }

            if (prevSize !== undefined) {
                const newSize = getItemSize(ctx, targetId!, scrollTarget!, state.props.data[scrollTarget!]);
                if (newSize !== undefined) {
                    positionDiff = (newSize - prevSize) * scrollingToViewPosition!;
                }
            }

            if (positionDiff !== undefined && Math.abs(positionDiff) > 0.1) {
                requestAdjust(ctx, positionDiff, dataChanged && maintainVisibleContentPosition);
            }
        };
    }
}
