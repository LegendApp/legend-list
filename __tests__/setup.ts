// Global test setup for Legend List tests
import { afterEach, beforeEach, mock } from "bun:test";

// Define React Native globals that the source code expects
global.nativeFabricUIManager = {}; // Set to non-null for IsNewArchitecture = true

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

// Mock react-native module for all tests to avoid loading the real RN package
mock.module("react-native", () => import("./__mocks__/react-native.ts"));
mock.module("react-native/index.js", () => import("./__mocks__/react-native.ts"));

// Force Bun's resolver to use React Native specific entry points like Metro does
const nativeModuleOverrides: Array<[string, string]> = [
    ["@/hooks/useOnLayoutSync", "../src/hooks/useOnLayoutSync.native.tsx"],
    ["@/components/Containers", "../src/components/Containers.native.tsx"],
    ["@/components/Padding", "../src/components/Padding.native.tsx"],
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
    ["@/core/doScrollTo", "../src/core/doScrollTo.native.ts"],
    ["@/platform/getWindowSize", "../src/platform/getWindowSize.native.ts"],
    ["@/platform/batchedUpdates", "../src/platform/batchedUpdates.native.ts"],
    ["@/constants-platform", "../src/constants-platform.native.ts"],
];

for (const [moduleSpecifier, nativePath] of nativeModuleOverrides) {
    mock.module(moduleSpecifier, () => import(nativePath));
}

// Global cleanup between tests to prevent contamination
afterEach(() => {
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
});

// Even stronger cleanup after each test file
import { afterAll } from "bun:test";

afterAll(() => {
    // Force restore any mocked functions to originals
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
});

// Provide raf fallback for code paths that expect it
if (typeof globalThis.requestAnimationFrame !== "function") {
    // @ts-ignore
    globalThis.requestAnimationFrame = (cb: Function) => setTimeout(cb, 0);
}
