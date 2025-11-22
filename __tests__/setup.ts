// Global test setup for Legend List tests
import { afterEach, beforeEach, mock } from "bun:test";

// Define React Native globals that the source code expects
global.__DEV__ = false;
global.nativeFabricUIManager = {}; // Set to non-null for IsNewArchitecture = true

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
    // Attempt to restore any global spies that might be lingering
    const possibleMocks = [globalThis.setTimeout, globalThis.clearTimeout, globalThis.requestAnimationFrame];
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
