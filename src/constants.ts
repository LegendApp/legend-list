import type { AnchoredPosition } from "./types";

export const POSITION_OUT_OF_VIEW = -10000000;
export const ANCHORED_POSITION_OUT_OF_VIEW: AnchoredPosition = {
    type: "top",
    relativeCoordinate: POSITION_OUT_OF_VIEW,
    top: POSITION_OUT_OF_VIEW,
};

// use colorful overlays to visualize the padding and scroll adjustments
// green means paddingTop (used for aligning elements at the bottom)
// lightblue means scrollAdjust (used for maintainVisibleContentPosition) positive values
// blue arrow at the rights means negative scrollAdjust (used for maintainVisibleContentPosition) negative values
export const MVCP_DEVMODE = false;
