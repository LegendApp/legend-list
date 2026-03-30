import { describe, expect, it } from "bun:test";
import {
    createEndAlignedInitialScrollTarget,
    resolveInitialScrollTarget,
    shouldFinishEmptyInitialScrollAtEnd,
    shouldFinishInitialScrollAtOrigin,
    shouldKeepEndAlignedInitialScrollTarget,
    shouldRearmFinishedEmptyInitialScrollAtEnd,
    shouldRetryFinishedInitialScrollAfterLayoutChange,
    trackInitialScrollRetryWindow,
} from "../../src/components/initialScroll";

describe("initialScroll helpers", () => {
    it("defaults a trailing object initialScrollIndex to end alignment", () => {
        const result = resolveInitialScrollTarget({
            dataLength: 3,
            initialScrollAtEnd: false,
            initialScrollIndex: { index: 2 },
            initialScrollOffset: undefined,
            stylePaddingBottom: 12,
        });

        expect(result.initialScrollUsesOffsetOnly).toBe(false);
        expect(result.initialScroll).toEqual({
            index: 2,
            viewOffset: -12,
            viewPosition: 1,
        });
    });

    it("treats offset-only initial scroll as an absolute content offset", () => {
        const result = resolveInitialScrollTarget({
            dataLength: 20,
            initialScrollAtEnd: false,
            initialScrollIndex: undefined,
            initialScrollOffset: 250,
            stylePaddingBottom: 0,
        });

        expect(result.initialScrollUsesOffsetOnly).toBe(true);
        expect(result.initialScroll).toEqual({
            contentOffset: 250,
            index: 0,
            viewOffset: 0,
        });
    });

    it("builds an end-aligned target from the last item and footer-adjusted offset", () => {
        expect(
            createEndAlignedInitialScrollTarget({
                dataLength: 5,
                stylePaddingBottom: 6,
                viewOffset: -46,
            }),
        ).toEqual({
            contentOffset: undefined,
            index: 4,
            viewOffset: -46,
            viewPosition: 1,
        });
    });

    it("keeps a matching end-aligned target unless the caller explicitly rearms it", () => {
        const initialScroll = { index: 4, viewOffset: -6, viewPosition: 1 };

        expect(
            shouldKeepEndAlignedInitialScrollTarget({
                dataLength: 5,
                initialScroll,
                initialScrollUsesOffset: false,
                shouldRearm: false,
            }),
        ).toBe(true);
        expect(
            shouldKeepEndAlignedInitialScrollTarget({
                dataLength: 5,
                initialScroll,
                initialScrollUsesOffset: false,
                shouldRearm: true,
            }),
        ).toBe(false);
    });

    it("finishes origin initial scrolls without a native scroll when already resolved", () => {
        expect(
            shouldFinishInitialScrollAtOrigin({
                initialScroll: { index: 0, viewOffset: 0, viewPosition: 0 },
                initialScrollAtEnd: false,
                initialScrollUsesOffset: false,
                offset: 0,
            }),
        ).toBe(true);
        expect(
            shouldFinishInitialScrollAtOrigin({
                initialScroll: { contentOffset: 0, index: 0, viewOffset: 0 },
                initialScrollAtEnd: false,
                initialScrollUsesOffset: true,
                offset: 0,
            }),
        ).toBe(true);
    });

    it("recognizes empty initialScrollAtEnd mounts that should finish at offset zero", () => {
        expect(
            shouldFinishEmptyInitialScrollAtEnd({
                dataLength: 0,
                initialScroll: { index: 0, viewOffset: 0, viewPosition: 1 },
                initialScrollAtEnd: true,
                offset: 0,
            }),
        ).toBe(true);
    });

    it("rearms a finished empty initialScrollAtEnd target when data arrives", () => {
        expect(
            shouldRearmFinishedEmptyInitialScrollAtEnd({
                dataLength: 1,
                initialScroll: { contentOffset: 0, index: 0, viewOffset: 0, viewPosition: 1 },
                state: {
                    didFinishInitialScroll: true,
                    initialScrollUsesOffset: false,
                },
            }),
        ).toBe(true);
    });

    it("tracks the post-finish retry window and only retries index-based targets inside it", () => {
        const state = {
            didFinishInitialScroll: true,
            initialScrollLastDidFinish: false,
            initialScrollLastTarget: { index: 3, viewOffset: 0, viewPosition: 1 },
            initialScrollLastTargetUsesOffset: false,
            initialScrollRetryLastLength: 200,
            initialScrollRetryWindowUntil: 0,
            scrollLength: 260,
        };

        const now = 1_000;
        const { didScrollLengthChange } = trackInitialScrollRetryWindow(state, now);

        expect(didScrollLengthChange).toBe(true);
        expect(state.initialScrollLastDidFinish).toBe(true);
        expect(state.initialScrollRetryLastLength).toBe(260);
        expect(state.initialScrollRetryWindowUntil).toBe(1_600);
        expect(shouldRetryFinishedInitialScrollAfterLayoutChange(state, now, didScrollLengthChange)).toBe(true);
        expect(shouldRetryFinishedInitialScrollAfterLayoutChange(state, 1_601, didScrollLengthChange)).toBe(false);
    });
});
