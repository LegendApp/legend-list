import { describe, expect, it } from "bun:test";

import {
    hasFinishedStartupScroll,
    hasStartupLayoutCheckpoint,
    isStartupReadyToRender,
    markFinishedStartupScroll,
    markStartupLayoutCheckpoint,
    markStartupLayoutComplete,
    resetFinishedStartupScroll,
} from "../../src/core/startupState";
import { createMockState } from "../__mocks__/createMockState";

describe("startupState", () => {
    it("tracks startup layout checkpoints separately from render readiness", () => {
        const state = createMockState({
            didContainersLayout: false,
            didFinishInitialScroll: false,
            queuedInitialLayout: false,
        });

        expect(hasStartupLayoutCheckpoint(state)).toBe(false);
        expect(isStartupReadyToRender(state)).toBe(false);

        markStartupLayoutCheckpoint(state);

        expect(hasStartupLayoutCheckpoint(state)).toBe(true);
        expect(isStartupReadyToRender(state)).toBe(false);
    });

    it("marks startup complete only after layout and initial scroll completion", () => {
        const state = createMockState({
            didContainersLayout: false,
            didFinishInitialScroll: false,
        });

        markStartupLayoutComplete(state);
        expect(isStartupReadyToRender(state)).toBe(false);

        markFinishedStartupScroll(state);
        expect(hasFinishedStartupScroll(state)).toBe(true);
        expect(isStartupReadyToRender(state)).toBe(true);
    });

    it("can reset startup scroll completion without affecting layout checkpoint", () => {
        const state = createMockState({
            didContainersLayout: true,
            didFinishInitialScroll: true,
            queuedInitialLayout: true,
        });

        resetFinishedStartupScroll(state);

        expect(hasFinishedStartupScroll(state)).toBe(false);
        expect(hasStartupLayoutCheckpoint(state)).toBe(true);
        expect(isStartupReadyToRender(state)).toBe(false);
    });
});
