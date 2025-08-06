export const POSITION_OUT_OF_VIEW = -10000000;

// use colorful overlays to visualize the padding and scroll adjustments
// green means paddingTop (used for aligning elements at the bottom)
// lightblue means scrollAdjust (used for maintainVisibleContentPosition) positive values
// blue arrow at the rights means negative scrollAdjust (used for maintainVisibleContentPosition) negative values
export const ENABLE_DEVMODE = __DEV__ && false;
export const ENABLE_DEBUG_VIEW = __DEV__ && false;

// For web, we don't have the new architecture concept, so default to false
export const IsNewArchitecture = typeof globalThis !== 'undefined' && 
  typeof (globalThis as any).nativeFabricUIManager !== 'undefined' ? 
  (globalThis as any).nativeFabricUIManager != null : false;
