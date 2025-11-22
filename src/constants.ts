export const POSITION_OUT_OF_VIEW = -10000000;

// use colorful overlays to visualize the padding and scroll adjustments
// green means paddingTop (used for aligning elements at the bottom)
// lightblue means scrollAdjust (used for maintainVisibleContentPosition) positive values
// blue arrow at the rights means negative scrollAdjust (used for maintainVisibleContentPosition) negative values
export const ENABLE_DEVMODE = __DEV__ && false;
export const ENABLE_DEBUG_VIEW = __DEV__ && false;

// @ts-expect-error nativeFabricUIManager is not defined in the global object types
export const IsNewArchitecture = global.nativeFabricUIManager != null;
