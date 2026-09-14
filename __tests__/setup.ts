// Global test setup for Legend List tests
import { afterEach, mock } from "bun:test";
import { registerReanimatedModuleMock } from "./__mocks__/reanimated";
import { cleanupRenders } from "./helpers/testingLibrary";

// Define React Native globals that the source code expects
global.nativeFabricUIManager = {}; // Set to non-null for IsNewArchitecture = true
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Ensure NODE_ENV defaults to a non-production value for dev-mode assertions
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "test";
}

// Mock React Native constants if needed
if (typeof global.window === "undefined") {
    global.window = {} as any;
}

// Store original functions for restoration
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
const pendingAnimationFrames = new Set<ReturnType<typeof setTimeout>>();
const testRequestAnimationFrame: typeof requestAnimationFrame = (callback) => {
    const handle = originalSetTimeout(() => {
        pendingAnimationFrames.delete(handle);
        callback(Date.now());
    }, 0);
    pendingAnimationFrames.add(handle);
    return handle as unknown as number;
};
const testCancelAnimationFrame: typeof cancelAnimationFrame = (id) => {
    const handle = id as unknown as ReturnType<typeof setTimeout>;
    pendingAnimationFrames.delete(handle);
    originalClearTimeout(handle);
};

globalThis.requestAnimationFrame = originalRequestAnimationFrame ?? testRequestAnimationFrame;
globalThis.cancelAnimationFrame = originalCancelAnimationFrame ?? testCancelAnimationFrame;

// Force Bun's resolver to use React Native specific entry points like Metro does
const nativeModuleOverrides: Array<[string, string]> = [
    ["@/hooks/useOnLayoutSync", "../src/hooks/useOnLayoutSync.native.tsx"],
    ["@/core/measureContainersInLayoutEffect", "../src/core/measureContainersInLayoutEffect.native.ts"],
    ["@/components/Containers", "../src/components/Containers.native.tsx"],
    ["@/components/ListComponentScrollView", "../src/components/ListComponentScrollView.native.tsx"],
    ["@/components/DevNumbers", "../src/components/DevNumbers.native.tsx"],
    ["@/components/PositionView", "../src/components/PositionView.native.tsx"],
    ["@/components/ScrollAdjust", "../src/components/ScrollAdjust.native.tsx"],
    ["@/platform/Animated", "../src/platform/Animated.native.tsx"],
    ["@/platform/I18nManager", "../src/platform/I18nManager.native.ts"],
    ["@/platform/LayoutView", "../src/platform/LayoutView.native.tsx"],
    ["@/platform/PixelRatio", "../src/platform/PixelRatio.native.ts"],
    ["@/platform/RefreshControl", "../src/platform/RefreshControl.native.tsx"],
    ["@/platform/StyleSheet", "../src/platform/StyleSheet.native.tsx"],
    ["@/platform/ViewComponents", "../src/platform/ViewComponents.native.tsx"],
    ["@/platform/useStickyScrollHandler", "../src/platform/useStickyScrollHandler.native.ts"],
    ["@/platform/Platform", "../src/platform/Platform.native.ts"],
    ["@/platform/getWindowSize", "../src/platform/getWindowSize.native.ts"],
    ["@/platform/batchedUpdates", "../src/platform/batchedUpdates.native.ts"],
    ["@/platform/flushSync", "../src/platform/flushSync.native.ts"],
    ["@/constants-platform", "../src/constants-platform.native.ts"],
];

// Bun's mock.restore() restores spies, but not mock.module() replacements. Snapshot
// the original exports before any test runs, including the native alias targets.
// Requiring them again during cleanup would just capture the last test's mock.
let baseModuleExports: Array<[string, Record<string, unknown>]> | undefined;

export function registerBaseModuleMocks() {
    registerReanimatedModuleMock();
    // Mock react-native module for all tests to avoid loading the real RN package
    mock.module("react-native", () => require("./__mocks__/react-native.ts"));
    mock.module("react-native/index.js", () => require("./__mocks__/react-native.ts"));

    if (baseModuleExports) {
        for (const [moduleSpecifier, exports] of baseModuleExports) {
            mock.module(moduleSpecifier, () => exports);
        }
    } else {
        for (const [moduleSpecifier, nativePath] of nativeModuleOverrides) {
            mock.module(moduleSpecifier, () => require(nativePath));
        }
    }
}

registerBaseModuleMocks();
const nativeMocks = require("./__mocks__/react-native.ts");
const defaultPlatform = { ...nativeMocks.Platform };
const defaultI18nManager = { ...nativeMocks.I18nManager };
baseModuleExports = nativeModuleOverrides.map(([moduleSpecifier]) => [
    moduleSpecifier,
    { ...require(moduleSpecifier) },
]);
for (const moduleSpecifier of [
    "@/components/ListComponent",
    "@/components/Container",
    "@/components/LegendList",
    "@/components/webScrollUtils",
    "@/core/ScrollAdjustHandler",
    "@/core/scrollToIndex",
    "@/core/checkResetContainers",
    "@/core/scrollTo",
    "@/utils/requestAdjust",
    "@/utils/useRafCoalescer",
    "@/state/state",
    "@/hooks/createResizeObserver",
    "@/hooks/useAnimatedValue",
    "@legendapp/list/react-native",
    "@legendapp/list/react",
]) {
    baseModuleExports.push([moduleSpecifier, { ...require(moduleSpecifier) }]);
}

// Global cleanup between tests to prevent contamination
afterEach(() => {
    cleanupRenders();

    for (const handle of pendingAnimationFrames) {
        originalClearTimeout(handle);
    }
    pendingAnimationFrames.clear();

    // Restore any potentially mocked functions
    if (globalThis.setTimeout !== originalSetTimeout) {
        globalThis.setTimeout = originalSetTimeout;
    }
    if (globalThis.clearTimeout !== originalClearTimeout) {
        globalThis.clearTimeout = originalClearTimeout;
    }
    globalThis.requestAnimationFrame = originalRequestAnimationFrame ?? testRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame ?? testCancelAnimationFrame;

    mock.restore();
    Object.assign(nativeMocks.Platform, defaultPlatform);
    Object.assign(nativeMocks.I18nManager, defaultI18nManager);
    registerBaseModuleMocks();
});
