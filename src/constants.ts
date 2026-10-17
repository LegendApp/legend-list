import { IS_DEV } from "@/utils/devEnvironment";

export const POSITION_OUT_OF_VIEW = -10000000;
export const EDGE_POSITION_EPSILON = 1;
// A late momentum-begin suspends following again after the release timeout.
export const USER_MOMENTUM_WAIT_TIMEOUT_MS = 100;
export const USER_MOMENTUM_STALL_TIMEOUT_MS = 500;

// use colorful overlays to visualize the padding and scroll adjustments
// green means paddingTop (used for aligning elements at the bottom)
// lightblue means scrollAdjust (used for maintainVisibleContentPosition) positive values
// blue arrow at the rights means negative scrollAdjust (used for maintainVisibleContentPosition) negative values
export const ENABLE_DEVMODE = IS_DEV && false;
export const ENABLE_DEBUG_VIEW = IS_DEV && false;
