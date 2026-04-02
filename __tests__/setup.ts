// Global test setup for Legend List tests
import { afterAll, afterEach, mock } from "bun:test";
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

// Force Bun's resolver to use React Native specific entry points like Metro does
const nativeModuleOverrides: Array<[string, string]> = [
    ["@/hooks/useOnLayoutSync", "../src/hooks/useOnLayoutSync.native.tsx"],
    ["@/components/Containers", "../src/components/Containers.native.tsx"],
    ["@/components/ListComponentScrollView", "../src/components/ListComponentScrollView.native.tsx"],
    ["@/components/DevNumbers", "../src/components/DevNumbers.native.tsx"],
    ["@/components/PositionView", "../src/components/PositionView.native.tsx"],
    ["@/components/ScrollAdjust", "../src/components/ScrollAdjust.native.tsx"],
    ["@/platform/Animated", "../src/platform/Animated.native.tsx"],
    ["@/platform/LayoutView", "../src/platform/LayoutView.native.tsx"],
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

export function registerBaseModuleMocks() {
    // Mock react-native module for all tests to avoid loading the real RN package
    mock.module("react-native", () => import("./__mocks__/react-native.ts"));
    mock.module("react-native/index.js", () => import("./__mocks__/react-native.ts"));

    for (const [moduleSpecifier, nativePath] of nativeModuleOverrides) {
        mock.module(moduleSpecifier, () => import(nativePath));
    }
}

registerBaseModuleMocks();

// Global cleanup between tests to prevent contamination
afterEach(() => {
    cleanupRenders();

    // Restore any potentially mocked functions
    if (globalThis.setTimeout !== originalSetTimeout) {
        globalThis.setTimeout = originalSetTimeout;
    }
    if (globalThis.clearTimeout !== originalClearTimeout) {
        globalThis.clearTimeout = originalClearTimeout;
    }
    // Keep requestAnimationFrame fallback in place between tests

    // Clear any pending timers
    // This is a simple approach - in production you'd use jest.clearAllTimers() or similar

    mock.restore();
    registerBaseModuleMocks();
});

afterAll(() => {
    // Force restore any mocked functions to originals
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
});

// Provide raf fallback for code paths that expect it
if (typeof globalThis.requestAnimationFrame !== "function") {
    // @ts-ignore
    globalThis.requestAnimationFrame = (cb: (timestamp: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number;
}

if (typeof globalThis.cancelAnimationFrame !== "function") {
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
