import { I18nManager, Platform } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { getWindowSize } from "@/platform/getWindowSize";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { peek$ } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import { registerBaseModuleMocks } from "../setup";

describe("test isolation", () => {
    const initialPeek = peek$;
    const initialGetWindowSize = getWindowSize;
    const initialRAF = globalThis.requestAnimationFrame;
    const initialAnimatedScrollHandler = Reanimated.useAnimatedScrollHandler;
    let leakedFrameCalls = 0;

    beforeEach(async () => {
        // Give any leaked zero-delay work from the previous case time to run.
        await new Promise((resolve) => setTimeout(resolve, 1));
        expect(leakedFrameCalls).toBe(0);
        expect(peek$).toBe(initialPeek);
        expect(getWindowSize).toBe(initialGetWindowSize);
        expect(globalThis.requestAnimationFrame).toBe(initialRAF);
        expect(Platform.OS).toBe("ios");
        expect(I18nManager.isRTL).toBe(false);
        expect(Reanimated.useAnimatedScrollHandler).toBe(initialAnimatedScrollHandler);
        expect(Reanimated.default.useAnimatedScrollHandler).toBe(initialAnimatedScrollHandler);
    });

    it("restores source module replacements, not just function spies", () => {
        const ctx = createMockContext({ totalSize: 123 });
        mock.module("@/state/state", () => ({ peek$: () => -1 }));
        expect(peek$(ctx, "totalSize")).toBe(-1);

        registerBaseModuleMocks();
        expect(peek$(ctx, "totalSize")).toBe(123);
    });

    it("restores native aliases from the original exports", () => {
        mock.module("@/platform/getWindowSize", () => ({ getWindowSize: () => ({ height: 1, width: 1 }) }));
        expect(getWindowSize()).toEqual({ height: 1, width: 1 });

        registerBaseModuleMocks();
        expect(getWindowSize).toBe(initialGetWindowSize);
    });

    it("does not share mutable default insets between mock states or contexts", () => {
        const state = createMockState();
        const ctx = createMockContext();
        state.props.contentInset.top = 30;
        peek$(ctx, "contentInset")!.bottom = 40;

        expect(createMockState().props.contentInset.top).toBe(0);
        expect(peek$(createMockContext(), "contentInset")!.bottom).toBe(0);
    });

    it("does not leak mutable platform settings to later tests", () => {
        Platform.OS = "android";
        I18nManager.isRTL = true;
    });

    it("keeps Reanimated's full export shape when a suite overrides only one API", () => {
        const useAnimatedScrollHandler = mock(() => "custom handler");
        registerReanimatedModuleMock({ useAnimatedScrollHandler });

        expect(Reanimated.useAnimatedScrollHandler).toBe(useAnimatedScrollHandler);
        expect(Reanimated.default.useAnimatedScrollHandler).toBe(useAnimatedScrollHandler);
        expect(typeof Reanimated.useAnimatedProps).toBe("function");
        expect(typeof Reanimated.createAnimatedComponent).toBe("function");
        // Leave the override installed so the next case checks global cleanup.
    });

    for (let index = 0; index < 2; index++) {
        it(`discards unfinished animation frames during cleanup (${index})`, () => {
            requestAnimationFrame(() => leakedFrameCalls++);
        });
    }
});
