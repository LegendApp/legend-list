import { afterEach, describe, expect, it } from "bun:test";
import { shouldUseWebInitialScrollReplay } from "../../src/utils/shouldUseWebInitialScrollReplay";

const originalNavigator = globalThis.navigator;

describe("shouldUseWebInitialScrollReplay", () => {
    afterEach(() => {
        if (originalNavigator === undefined) {
            delete (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
        } else {
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: originalNavigator,
                writable: true,
            });
        }
    });

    it("returns false when navigator is unavailable", () => {
        delete (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;

        expect(shouldUseWebInitialScrollReplay()).toBe(false);
    });

    it("returns true for touch Safari browsers", () => {
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: {
                maxTouchPoints: 5,
                userAgent:
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
            },
            writable: true,
        });

        expect(shouldUseWebInitialScrollReplay()).toBe(true);
    });

    it("returns true for desktop Safari", () => {
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: {
                maxTouchPoints: 0,
                userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15",
            },
            writable: true,
        });

        expect(shouldUseWebInitialScrollReplay()).toBe(true);
    });

    it("returns false for Android touch browsers", () => {
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: {
                maxTouchPoints: 5,
                userAgent:
                    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",
            },
            writable: true,
        });

        expect(shouldUseWebInitialScrollReplay()).toBe(false);
    });

    it("returns false for desktop Chrome", () => {
        Object.defineProperty(globalThis, "navigator", {
            configurable: true,
            value: {
                maxTouchPoints: 0,
                userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            },
            writable: true,
        });

        expect(shouldUseWebInitialScrollReplay()).toBe(false);
    });
});
