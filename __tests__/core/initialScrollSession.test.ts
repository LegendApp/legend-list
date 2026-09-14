import { describe, expect, it, mock } from "bun:test";
import "../setup";

import { finishInitialScroll } from "../../src/core/finishInitialScroll";
import { setInitialScrollTarget } from "../../src/core/initialScroll";
import { initialScrollCompletion, initialScrollWatchdog } from "../../src/core/initialScrollSession";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("initialScrollSession", () => {
    for (const changedDataset of [false, true]) {
        it(`does not commit an old completion frame into a fresh dataset (${changedDataset})`, () => {
            const ctx = createMockContext();
            const onFinished = mock(() => {});
            const originalRAF = globalThis.requestAnimationFrame;
            let complete: FrameRequestCallback | undefined;
            globalThis.requestAnimationFrame = (callback) => {
                complete = callback;
                return 1;
            };
            ctx.state.didFinishInitialScroll = false;
            ctx.state.freshDataTransitionEpoch = 0;
            try {
                finishInitialScroll(ctx, { onFinished, waitForCompletionFrame: true });
                if (changedDataset) ctx.state.freshDataTransitionEpoch += 1;
                const target = { index: 24, viewPosition: 1 };
                ctx.state.initialScroll = target;
                expect(complete).toBeDefined();
                complete?.(0);
                expect(ctx.state.didFinishInitialScroll).toBe(!changedDataset);
                expect(ctx.state.initialScroll).toBe(changedDataset ? target : undefined);
                expect(onFinished).toHaveBeenCalledTimes(1);
            } finally {
                globalThis.requestAnimationFrame = originalRAF;
            }
        });
    }

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
        const ctx = createMockContext(
            {},
            {
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as any,
            },
        );

        setInitialScrollTarget(ctx, {
            contentOffset: 320,
            index: 0,
            viewOffset: 0,
        });

        expect(ctx.state.initialScrollSession).toMatchObject({
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
