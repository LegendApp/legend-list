import { describe, expect, it } from "bun:test";
import "../setup";

import { finishInitialScroll } from "../../src/core/finishInitialScroll";
import { setInitialScrollTarget } from "../../src/core/initialScroll";
import { initialScrollCompletion, initialScrollWatchdog } from "../../src/core/initialScrollSession";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("initialScrollSession", () => {
    it("derives an offset session from legacy offset-only state", () => {
        const state = createMockState({
            initialScroll: {
                contentOffset: 120,
                index: 0,
                viewOffset: 0,
            } as any,
            initialScrollSession: {
                kind: "offset",
                previousDataLength: 4,
            } as any,
        });

        expect(state.initialScrollSession).toMatchObject({
            kind: "offset",
            previousDataLength: 4,
        });
    });

    it("derives a bootstrap session from legacy index-based state", () => {
        const state = createMockState({
            initialScroll: {
                contentOffset: 250,
                index: 5,
                viewOffset: 12,
            } as any,
            initialScrollSession: {
                bootstrap: {
                    mountFrameCount: 2,
                    passCount: 3,
                    scroll: 250,
                    seedContentOffset: 0,
                    targetIndexSeed: 5,
                },
                kind: "bootstrap",
                previousDataLength: 8,
            } as any,
        });

        expect(state.initialScrollSession).toMatchObject({
            bootstrap: {
                mountFrameCount: 2,
                passCount: 3,
                scroll: 250,
                seedContentOffset: 0,
                targetIndexSeed: 5,
            },
            kind: "bootstrap",
            previousDataLength: 8,
        });
    });

    it("keeps the session kind in sync when the active target changes", () => {
        const state = createMockState({
            initialScrollSession: {
                kind: "offset",
                previousDataLength: 0,
            } as any,
        });

        setInitialScrollTarget(state, {
            contentOffset: 320,
            index: 0,
            viewOffset: 0,
        });

        expect(state.initialScrollSession).toMatchObject({
            kind: "offset",
        });
    });

    it("keeps a finished session when preserving the target after completion", () => {
        const ctx = createMockContext(
            {},
            {
                initialScroll: {
                    contentOffset: 220,
                    index: 0,
                    viewOffset: 0,
                } as any,
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as any,
                props: {
                    data: [],
                },
            },
        );

        finishInitialScroll(ctx, {
            preserveTarget: true,
        });

        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "offset",
        });
    });

    it("preserves offset sessions when completion metadata is recorded", () => {
        const state = createMockState({
            initialScroll: {
                contentOffset: 220,
                index: 0,
                viewOffset: 0,
            } as any,
            initialScrollSession: {
                kind: "offset",
                previousDataLength: 3,
            } as any,
        });

        initialScrollWatchdog.set(state, {
            startScroll: 0,
            targetOffset: 220,
        });
        initialScrollCompletion.markInitialScrollNativeDispatch(state);
        initialScrollCompletion.markSilentInitialScrollRetry(state);

        expect(state.initialScrollSession).toMatchObject({
            completion: {
                didDispatchNativeScroll: true,
                didRetrySilentInitialScroll: true,
                watchdog: {
                    startScroll: 0,
                    targetOffset: 220,
                },
            },
            kind: "offset",
            previousDataLength: 3,
        });
    });
});
