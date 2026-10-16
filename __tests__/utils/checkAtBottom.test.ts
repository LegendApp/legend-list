import { afterEach, describe, expect, it } from "bun:test";
import "../setup";

import { clampScrollOffset } from "../../src/core/clampScrollOffset";
import { Platform } from "../../src/platform/Platform";
import { listen$ } from "../../src/state/state";
import { checkAtBottom } from "../../src/utils/checkAtBottom";
import { createMockContext } from "../__mocks__/createMockContext";
import { createMockState } from "../__mocks__/createMockState";

describe("checkAtBottom", () => {
    it.each([0, 0.5, 1, 1.01, 30])("uses the end-position epsilon for zero-threshold following at %ipx", (gap) => {
        const ctx = createMockContext(
            { totalSize: 1000 },
            {
                props: { data: [{ id: 1 }], maintainScrollAtEndThreshold: 0 },
                queuedInitialLayout: true,
                scroll: 700 - gap,
                scrollLength: 300,
            },
        );
        checkAtBottom(ctx);
        expect(ctx.values.get("isAtEnd")).toBe(gap <= 1);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(gap <= 1);
    });

    for (const inset of [
        { name: "vertical prop", props: { contentInset: { bottom: 100 } } },
        { name: "horizontal prop", props: { contentInset: { right: 100 }, horizontal: true } },
        { name: "horizontal RTL prop", props: { contentInset: { left: 100 }, horizontal: true, rtl: true } },
        { name: "reported inset", override: { bottom: 100 }, props: {} },
        { name: "end adjustment", props: { contentInsetEndAdjustment: 100 } },
    ]) {
        it(`measures the remaining scroll range consistently with clamping (${inset.name})`, () => {
            const calls: number[] = [];
            const ctx = createMockContext(
                { totalSize: 1000 },
                {
                    contentInsetOverride: inset.override,
                    isEndReached: false,
                    props: {
                        data: [{ id: 1 }],
                        onEndReached: ({ distanceFromEnd }) => calls.push(distanceFromEnd),
                        onEndReachedThreshold: 0.2,
                        ...inset.props,
                    },
                    queuedInitialLayout: true,
                    scrollLength: 300,
                },
            );
            const end = clampScrollOffset(ctx, Number.POSITIVE_INFINITY);
            expect(end).toBe(800);

            // The final row is visible, but 100px of inset remains to scroll.
            // Following at this position would steal a user's scroll away from the end.
            ctx.state.scroll = end - 100;
            checkAtBottom(ctx);
            expect(ctx.values.get("isAtEnd")).toBe(false);
            expect(ctx.values.get("isNearEnd")).toBe(false);
            expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);
            expect(calls).toEqual([]);

            ctx.state.scroll = end - 50;
            checkAtBottom(ctx);
            expect(calls).toEqual([50]);
            expect(ctx.values.get("isAtEnd")).toBe(false);
            ctx.state.scroll = end;
            checkAtBottom(ctx);
            expect(ctx.values.get("isAtEnd")).toBe(true);
            expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);
        });
    }

    describe("platform-specific contentInset prop counting", () => {
        const originalPlatform = Platform.OS;

        afterEach(() => {
            Platform.OS = originalPlatform;
        });

        // Only iOS applies the contentInset prop natively, so only there does
        // it extend the scroll range. Android and web scroll views ignore the
        // prop, so counting it would make the end appear 100px further away
        // than the native scroll range actually has.
        for (const os of ["android", "web"] as const) {
            it(`ignores the contentInset prop on ${os}`, () => {
                Platform.OS = os;
                const ctx = createMockContext(
                    { totalSize: 1000 },
                    {
                        props: {
                            contentInset: { bottom: 100, left: 0, right: 0, top: 0 },
                            data: [{ id: 1 }],
                            maintainScrollAtEndThreshold: 0,
                        },
                        queuedInitialLayout: true,
                        scroll: 700,
                        scrollLength: 300,
                    },
                );
                // Native scroll range ends at 700 despite the ignored prop inset.
                checkAtBottom(ctx);
                expect(ctx.values.get("isAtEnd")).toBe(true);
                expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);

                ctx.state.scroll = 600;
                checkAtBottom(ctx);
                expect(ctx.values.get("isAtEnd")).toBe(false);
            });
        }

        it("counts the contentInset prop on ios", () => {
            Platform.OS = "ios";
            const ctx = createMockContext(
                { totalSize: 1000 },
                {
                    props: {
                        contentInset: { bottom: 100, left: 0, right: 0, top: 0 },
                        data: [{ id: 1 }],
                        maintainScrollAtEndThreshold: 0,
                    },
                    queuedInitialLayout: true,
                    scrollLength: 300,
                },
            );
            const end = clampScrollOffset(ctx, Number.POSITIVE_INFINITY);
            expect(end).toBe(800);

            // The native inset still has to be scrolled through before the
            // list is at its scrollable end.
            ctx.state.scroll = end - 100;
            checkAtBottom(ctx);
            expect(ctx.values.get("isAtEnd")).toBe(false);
            expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);

            ctx.state.scroll = end;
            checkAtBottom(ctx);
            expect(ctx.values.get("isAtEnd")).toBe(true);
            expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);
        });

        for (const os of ["ios", "android", "web"] as const) {
            it(`counts a reported inset on ${os}`, () => {
                Platform.OS = os;
                const ctx = createMockContext(
                    { totalSize: 1000 },
                    {
                        contentInsetOverride: { bottom: 100 },
                        props: { data: [{ id: 1 }], maintainScrollAtEndThreshold: 0 },
                        queuedInitialLayout: true,
                        scrollLength: 300,
                    },
                );
                // Reported insets are realized as real scroll range everywhere.
                ctx.state.scroll = 700;
                checkAtBottom(ctx);
                expect(ctx.values.get("isAtEnd")).toBe(false);
                ctx.state.scroll = 800;
                checkAtBottom(ctx);
                expect(ctx.values.get("isAtEnd")).toBe(true);
            });

            it(`counts an end adjustment on ${os}`, () => {
                Platform.OS = os;
                const ctx = createMockContext(
                    { totalSize: 1000 },
                    {
                        props: {
                            contentInsetEndAdjustment: 100,
                            data: [{ id: 1 }],
                            maintainScrollAtEndThreshold: 0,
                        },
                        queuedInitialLayout: true,
                        scrollLength: 300,
                    },
                );
                ctx.state.scroll = 700;
                checkAtBottom(ctx);
                expect(ctx.values.get("isAtEnd")).toBe(false);
                ctx.state.scroll = 800;
                checkAtBottom(ctx);
                expect(ctx.values.get("isAtEnd")).toBe(true);
            });
        }
    });

    it("returns early when state is null or undefined", () => {
        const ctx = createMockContext();
        ctx.state = null as any;
        expect(() => checkAtBottom(ctx)).not.toThrow();
        ctx.state = undefined as any;
        expect(() => checkAtBottom(ctx)).not.toThrow();
    });

    it("does not fire on initial mount when content is shorter than the viewport", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 200 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            initialScroll: { index: 0, viewOffset: 0 },
            isEndReached: null,
            props: {
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2,
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
        expect(calls).toEqual([]);
    });

    it("allows end checks after initial scroll finished even if the target is preserved", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            didFinishInitialScroll: true,
            initialScroll: { index: 5, viewPosition: 1 },
            isEndReached: null,
            props: {
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2,
            },
            queuedInitialLayout: true,
            scroll: 650,
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBe(true);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
    });

    it("returns early when queuedInitialLayout is false", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const state = createMockState({
            isEndReached: null,
            queuedInitialLayout: false,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
    });

    it("owns the end when an empty list fits before container layout", () => {
        const ctx = createMockContext({ totalSize: 0 });
        const state = createMockState({
            props: { data: [], maintainScrollAtEnd: true },
            queuedInitialLayout: false,
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(ctx.values.get("isAtEnd")).toBe(true);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);
        expect(state.isEndReached).toBeNull();
    });

    it("keeps the end threshold active during animated end maintenance", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        const state = createMockState({
            isEndReached: null,
            maintainingScrollAtEnd: "animated",
            queuedInitialLayout: true,
        });

        ctx.state = state;

        checkAtBottom(ctx);

        expect(state.isEndReached).toBeNull();
        expect(state.endReachedSnapshot).toBeUndefined();
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);
    });

    it("fires after leaving and re-entering the threshold window", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: 300,
        });

        ctx.state = state;

        // Outside threshold; establishes eligibility
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);

        // Re-enter threshold
        state.scroll = 650; // distanceFromEnd = 50
        checkAtBottom(ctx);

        expect(state.isEndReached).toBe(true);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);
        expect(state.endReachedSnapshot).toMatchObject({
            atThreshold: false,
            dataLength: state.props.data.length,
            scrollPosition: 650,
        });
    });

    it("accounts for contentInset when calculating distance from end", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                contentInset: { bottom: 100, left: 0, right: 0, top: 0 },
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 0,
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);

        state.scroll = 700;
        checkAtBottom(ctx);

        expect(calls).toEqual([]);
        expect(state.isEndReached).toBe(false);
        expect(ctx.values.get("isAtEnd")).toBe(false);

        state.scroll = 800;
        checkAtBottom(ctx);

        expect(calls).toEqual([{ distanceFromEnd: 0 }]);
        expect(state.isEndReached).toBe(true);
        expect(ctx.values.get("isAtEnd")).toBe(true);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);
    });

    it("resets after leaving hysteresis band", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const state = createMockState({
            isEndReached: null,
            props: {
                onEndReached: () => {},
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 500, // distanceFromEnd = 200
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx); // outside -> false
        expect(state.isEndReached).toBe(false);
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);

        state.scroll = 700; // distanceFromEnd = 0 -> inside -> true
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(true);
        expect(state.endReachedSnapshot).toBeDefined();
        expect(ctx.values.get("isAtEnd")).toBe(true);
        expect(ctx.values.get("isNearEnd")).toBe(true);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(true);

        state.scroll = 300; // distanceFromEnd = 400 -> beyond hysteresis
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);
        expect(state.endReachedSnapshot).toBeUndefined();
        expect(ctx.values.get("isAtEnd")).toBe(false);
        expect(ctx.values.get("isNearEnd")).toBe(false);
        expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(false);
    });

    it("does not re-fire inside threshold when content/data changes", () => {
        const ctx = createMockContext({ footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                data: [{ id: 1 }],
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 400, // distanceFromEnd = 300 (outside)
            scrollLength: 300,
        });

        ctx.state = state;

        // Outside threshold; mark eligible
        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);

        // Stay within threshold, no changes -> no fire
        state.scroll = 650; // distanceFromEnd = 50
        checkAtBottom(ctx);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        calls.length = 0;

        // Change content size and data length inside window -> no re-fire
        ctx.values.set("totalSize", 1400);
        state.props.data = [{ id: 1 }, { id: 2 }];
        state.scroll = 1100; // distanceFromEnd = 0 (inside)
        checkAtBottom(ctx);

        expect(calls).toEqual([]);
        expect(state.endReachedSnapshot).toMatchObject({
            contentSize: 1400,
            dataLength: 2,
        });
    });

    it("does not re-fire inside threshold when a conditional footer is removed", () => {
        const ctx = createMockContext({ footerSize: 40, headerSize: 0, stylePaddingTop: 0, totalSize: 1000 });
        const calls: Array<{ distanceFromEnd: number }> = [];
        const state = createMockState({
            isEndReached: null,
            props: {
                data: [{ id: 1 }],
                onEndReached: (payload) => calls.push(payload),
                onEndReachedThreshold: 0.2, // threshold = 60
            },
            queuedInitialLayout: true,
            scroll: 400, // outside threshold
            scrollLength: 300,
        });

        ctx.state = state;

        checkAtBottom(ctx);
        expect(state.isEndReached).toBe(false);

        state.scroll = 690; // contentSize = 1040, distanceFromEnd = 50
        checkAtBottom(ctx);
        expect(calls).toEqual([{ distanceFromEnd: 50 }]);
        calls.length = 0;

        ctx.values.set("footerSize", 0);
        state.scroll = 650; // contentSize = 1000, distanceFromEnd = 50
        checkAtBottom(ctx);

        expect(calls).toEqual([]);
        expect(state.endReachedSnapshot).toMatchObject({
            contentSize: 1000,
            dataLength: 1,
        });
    });

    it("publishes the end distance as a listenable signal", () => {
        const ctx = createMockContext({ totalSize: 1000 });
        ctx.state = createMockState({ queuedInitialLayout: true, scroll: 300, scrollLength: 200 });
        const distances: number[] = [];
        listen$(ctx, "distanceFromEnd", (distance) => distances.push(distance));

        checkAtBottom(ctx);

        expect(ctx.values.get("distanceFromEnd")).toBe(500);
        expect(distances).toEqual([500]);
    });

    it("keeps the maintain threshold active far from the end only while following", () => {
        for (const isFollowingEnd of [true, false]) {
            const ctx = createMockContext({ isFollowingEnd, totalSize: 1000 });
            ctx.state = createMockState({ queuedInitialLayout: true, scroll: 0, scrollLength: 200 });

            checkAtBottom(ctx);

            expect(ctx.values.get("isWithinMaintainScrollAtEndThreshold")).toBe(isFollowingEnd);
        }
    });
});
