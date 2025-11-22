import type { InternalState } from "@/types";

export const finishScrollTo = (state: InternalState | null | undefined) => {
    if (state) {
        state.scrollingTo = undefined;
        state.scrollHistory.length = 0;
    }
};
