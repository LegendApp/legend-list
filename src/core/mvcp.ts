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
                    positionDiff = newPosition - position;
                    break;
                }
            }
        }

        // If we have a targetId, then we can use the previous position of that item
        if (targetId !== undefined && prevPosition !== undefined) {
            const newPosition = positions.get(targetId);

            if (newPosition !== undefined) {
                positionDiff = newPosition - prevPosition;
            }
        }

        if (positionDiff !== undefined && Math.abs(positionDiff) > 0.1) {
            requestAdjust(ctx, state, positionDiff, dataChanged);
        }
    };
}
