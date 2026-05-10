import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import {
    advanceCurrentInitialScrollSession,
    resolveInitialScrollOffset,
    setInitialScrollTarget,
} from "../../src/core/initialScroll";
import * as scrollToModule from "../../src/core/scrollTo";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("initialScroll", () => {
    let scrollToSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        scrollToSpy = spyOn(scrollToModule, "scrollTo").mockImplementation(() => undefined);
    });

    afterEach(() => {
        scrollToSpy.mockRestore();
    });

    it("resolves offset sessions from raw contentOffset", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500],
                scrollLength: 300,
            },
        );

        const result = resolveInitialScrollOffset(ctx, {
            contentOffset: 220,
            index: 5,
            viewOffset: 40,
            viewPosition: 1,
        });

        expect(result).toBe(220);
    });

    it("resolves measured sessions from index math and clamps to the tail", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
                scrollLength: 300,
            },
        );

        const result = resolveInitialScrollOffset(ctx, {
            index: 9,
        });

        expect(result).toBe(700);
    });

    it("waits for measured layout before advancing bootstrap sessions that are not already scrolling", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                initialScroll: { index: 3, viewOffset: 0 } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400],
                queuedInitialLayout: false,
                scrollLength: 300,
            },
        );

        expect(advanceCurrentInitialScrollSession(ctx)).toBe(false);
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("advances an active bootstrap initial scroll before queuedInitialLayout when its resolved offset changes", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                initialScroll: { index: 3, viewOffset: 0 } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400],
                queuedInitialLayout: false,
                scrollingTo: {
                    animated: false,
                    isInitialScroll: true,
                    offset: 120,
                    targetOffset: 120,
                } as StateContext["state"]["scrollingTo"],
                scrollLength: 300,
            },
        );

        expect(advanceCurrentInitialScrollSession(ctx)).toBe(true);
        expect(ctx.state.initialScroll?.contentOffset).toBe(300);
        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                forceScroll: true,
                isInitialScroll: true,
                offset: 300,
                precomputedWithViewOffset: true,
            }),
        );
    });

    it("skips redundant bootstrap retries when the active initial-scroll target is unchanged", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                initialScroll: {
                    contentOffset: 300,
                    index: 3,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400],
                queuedInitialLayout: true,
                scrollingTo: {
                    animated: false,
                    isInitialScroll: true,
                    offset: 300,
                    targetOffset: 300,
                } as StateContext["state"]["scrollingTo"],
                scrollLength: 300,
            },
        );

        expect(advanceCurrentInitialScrollSession(ctx)).toBe(false);
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("retargets forced bootstrap retries when end inset changes after the old target was reached", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                contentInsetOverride: { bottom: 200 },
                initialScroll: {
                    contentOffset: 100,
                    index: 3,
                    viewOffset: 0,
                    viewPosition: 1,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "bootstrap",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                positions: [0, 100, 200, 300, 400],
                queuedInitialLayout: true,
                scroll: 100,
                scrollingTo: {
                    animated: false,
                    isInitialScroll: true,
                    offset: 100,
                    targetOffset: 100,
                    viewPosition: 1,
                } as StateContext["state"]["scrollingTo"],
                scrollLength: 300,
                scrollPending: 100,
            },
        );

        expect(advanceCurrentInitialScrollSession(ctx, { forceScroll: true })).toBe(true);
        expect(ctx.state.initialScroll?.contentOffset).toBe(300);
        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                forceScroll: true,
                isInitialScroll: true,
                offset: 300,
                precomputedWithViewOffset: true,
            }),
        );
    });

    it("forces offset sessions through scrollTo after layout is measured", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                initialScroll: {
                    contentOffset: 220,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                lastLayout: { height: 300, width: 320, x: 0, y: 0 } as StateContext["state"]["lastLayout"],
                scrollLength: 300,
            },
        );

        expect(advanceCurrentInitialScrollSession(ctx)).toBe(true);
        expect(scrollToSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                forceScroll: true,
                isInitialScroll: true,
                offset: 220,
                precomputedWithViewOffset: true,
            }),
        );
    });

    it("skips forced offset-session scrolls when already sitting on the desired target", () => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                initialScroll: {
                    contentOffset: 220,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
                scroll: 220,
                scrollLength: 300,
                scrollPending: 220,
            },
        );

        expect(advanceCurrentInitialScrollSession(ctx, { forceScroll: true })).toBe(false);
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("resets didFinishInitialScroll only when requested while preserving the session kind", () => {
        const ctx = createMockContext(
            {},
            {
                didFinishInitialScroll: true,
                initialScrollSession: {
                    kind: "offset",
                    previousDataLength: 0,
                } as StateContext["state"]["initialScrollSession"],
            },
        );

        setInitialScrollTarget(
            ctx.state,
            {
                contentOffset: 220,
                index: 0,
                viewOffset: 0,
            },
            { resetDidFinish: true },
        );

        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(ctx.state.initialScrollSession).toMatchObject({
            kind: "offset",
        });
    });
});
