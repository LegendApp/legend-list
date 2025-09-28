import { scrollTo } from "@/core/scrollTo";
import { scrollToIndex } from "@/core/scrollToIndex";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { requestAdjust } from "@/utils/requestAdjust";

export function prepareMVCP(ctx: StateContext, state: InternalState, dataChanged?: boolean): () => void {
    const {
        idsInView,
        positions,
        scrollingTo,
        props: { maintainVisibleContentPosition },
    } = state;

    let prevPosition: number;
    let targetId: string | undefined;
    const idsInViewWithPositions: { id: string; position: number }[] = [];
    const scrollTarget = scrollingTo?.index;

    if (maintainVisibleContentPosition) {
        const indexByKey = state.indexByKey;

        if (scrollTarget !== undefined) {
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
                targetId = state.idsInView.find((id) => indexByKey.get(id) !== undefined);
            }
        }

        if (targetId !== undefined) {
            prevPosition = positions.get(targetId)!;
        }
    }

    // Return a function to do MVCP based on the prepared values
    return () => {
        let positionDiff: number | undefined;

        // If data changed then we need to find the first item fully in view
        // which was exists in the new data
        if (dataChanged && targetId === undefined) {
            for (let i = 0; i < idsInViewWithPositions.length; i++) {
                const { id, position } = idsInViewWithPositions[i];
                const newPosition = positions.get(id);
                if (newPosition !== undefined) {
                    console.log(Math.round(performance.now()), "mvcp", newPosition - position, newPosition, position);
                    positionDiff = newPosition - position;
                    break;
                }
            }
        }

        // problem is we're doing mvcp for an item at the end of the screen which should not be
        // including height differences on items between it and the top of the screen
        if (targetId !== undefined && scrollTarget !== undefined) {
            const indexInView = idsInView.indexOf(targetId);
            if (indexInView > 0) {
                // targetId = "Item 60";
                // targetId = undefined;
                console.log("setting targetId to undefined");
                // console.log("setting targetId to Item 60");
                // for (let i = 0; i < indexInView; i++) {
                //     const id = idsInView[i];
                //     const position = positions.get(id);
                //     if (position !== undefined) {
                //         positionDiff += position - prevPosition;
                //     }
                // }
            }
            console.log(indexInView);
        }

        // If we have a targetId, then we can use the previous position of that item
        if (targetId !== undefined && prevPosition !== undefined) {
            const totalSize = peek$(ctx, "totalSize");
            const newPosition = positions.get(targetId);

            if (newPosition !== undefined) {
                let diff = newPosition - prevPosition;
                if (state.scroll + state.scrollLength > totalSize) {
                    if (diff > 0) {
                        diff = Math.max(0, totalSize - state.scroll - state.scrollLength);
                    } else {
                        diff = 0;
                    }
                }
                console.log(
                    Math.round(performance.now()),
                    "mvcp2",
                    diff,
                    newPosition - prevPosition,
                    newPosition,
                    prevPosition,
                    targetId,
                    state.scroll + state.scrollLength,
                    Math.round(totalSize),
                    Math.round(state.totalSize),
                );
                positionDiff = diff;
            }
        } else {
            console.log("mvcp no targetId");
        }

        if (positionDiff !== undefined && Math.abs(positionDiff) > 0.1) {
            console.log(Math.round(performance.now()), "requestAdjust mvcp", positionDiff);
            // requestAnimationFrame(() => {
            requestAdjust(ctx, state, positionDiff, dataChanged);
            // if (scrollingTo?.isInitialScroll) {
            //     scrollToIndex(ctx, state, { ...scrollingTo, animated: false });
            // }
            // });
        }
    };
}
