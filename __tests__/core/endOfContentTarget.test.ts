import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import {
    handleBootstrapInitialScrollDataChange,
    handleBootstrapInitialScrollFooterLayout,
} from "../../src/core/bootstrapInitialScroll";
import { getEndAlignedViewOffset, isEndOfContentTarget } from "../../src/core/endOfContentTarget";
import { resolveInitialScrollOffset } from "../../src/core/initialScroll";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { scrollToIndex } from "../../src/core/scrollToIndex";
import { getContentSize } from "../../src/state/getContentSize";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

type Target = NonNullable<StateContext["state"]["initialScroll"]>;

const ROW = 100;
const VIEWPORT = 400;
const ROWS = 8;
const LAST = ROWS - 1;

describe("getEndAlignedViewOffset", () => {
    it("is the negative sum of end padding and footer", () => {
        expect(getEndAlignedViewOffset(24, 80)).toBe(-104);
        expect(getEndAlignedViewOffset(0, 80)).toBe(-80);
        expect(getEndAlignedViewOffset(24, 0)).toBe(-24);
    });

    it("treats an unmeasured footer as zero", () => {
        expect(getEndAlignedViewOffset(24)).toBe(-24);
        expect(getEndAlignedViewOffset(0)).toBe(-0);
    });
});

describe("isEndOfContentTarget", () => {
    const base: Target = { index: LAST, preserveForBottomPadding: true, viewOffset: 0, viewPosition: 1 };

    it("accepts an automatically bottom-aligned target on the last row", () => {
        expect(isEndOfContentTarget(base, ROWS)).toBe(true);
    });

    it("accepts an out-of-range index because it clamps to the end", () => {
        expect(isEndOfContentTarget({ ...base, index: 999 }, ROWS)).toBe(true);
    });

    it("rejects rows before the last row", () => {
        expect(isEndOfContentTarget({ ...base, index: LAST - 1 }, ROWS)).toBe(false);
    });

    it("rejects targets that are not bottom-aligned", () => {
        expect(isEndOfContentTarget({ ...base, viewPosition: 0 }, ROWS)).toBe(false);
        expect(isEndOfContentTarget({ ...base, viewPosition: 0.5 }, ROWS)).toBe(false);
        expect(isEndOfContentTarget({ ...base, viewPosition: undefined }, ROWS)).toBe(false);
    });

    it("rejects explicit alignments that were not auto-derived", () => {
        expect(isEndOfContentTarget({ ...base, preserveForBottomPadding: undefined }, ROWS)).toBe(false);
    });

    it("rejects missing targets, missing indexes, and empty data", () => {
        expect(isEndOfContentTarget(undefined, ROWS)).toBe(false);
        expect(isEndOfContentTarget({ ...base, index: undefined }, ROWS)).toBe(false);
        expect(isEndOfContentTarget(base, 0)).toBe(false);
    });

    it("stops matching once data grows past the target row", () => {
        expect(isEndOfContentTarget(base, ROWS + 4)).toBe(false);
    });
});

describe("end-of-content vs item-aligned offsets", () => {
    let originalRequestAnimationFrame: typeof requestAnimationFrame;
    let rafHandle = 0;
    const contexts: StateContext[] = [];

    beforeEach(() => {
        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = ((_cb: FrameRequestCallback) => ++rafHandle) as typeof requestAnimationFrame;
    });

    afterEach(() => {
        for (const ctx of contexts.splice(0)) ctx.state.scheduledWork.dispose();
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        rafHandle = 0;
    });

    function setup(options: {
        footer: number;
        horizontal?: boolean;
        initialScroll?: Target;
        padding?: number;
        rows?: number;
        session?: boolean;
    }) {
        const { footer, horizontal = false, initialScroll, padding = 0, rows = ROWS, session = false } = options;
        const data = Array.from({ length: rows }, (_, index) => ({ id: String(index) }));
        const ctx = createMockContext(
            { footerSize: footer, readyToRender: true, totalSize: rows * ROW },
            {
                didContainersLayout: true,
                idCache: data.map((item) => item.id),
                indexByKey: new Map(data.map((item, index) => [item.id, index])),
                initialScroll,
                initialScrollSession: session
                    ? ({
                          bootstrap: {
                              frameHandle: undefined,
                              mountFrameCount: 1,
                              passCount: 0,
                              scroll: 0,
                              seedContentOffset: 0,
                              targetIndexSeed: 0,
                          },
                          kind: "bootstrap",
                          previousDataLength: rows,
                      } as StateContext["state"]["initialScrollSession"])
                    : undefined,
                lastLayout: { height: horizontal ? 300 : VIEWPORT, width: horizontal ? VIEWPORT : 300, x: 0, y: 0 },
                otherAxisSize: 300,
                positions: data.map((_, index) => index * ROW),
                props: {
                    data,
                    estimatedItemSize: ROW,
                    horizontal,
                    keyExtractor: (item: { id: string }) => item.id,
                    stylePaddingBottom: horizontal ? 0 : padding,
                    stylePaddingRight: horizontal ? padding : 0,
                },
                scrollLength: VIEWPORT,
                sizes: new Map(data.map((item) => [item.id, ROW])),
                sizesKnown: new Map(data.map((item) => [item.id, ROW])),
            },
        );
        ctx.state.refScroller.current = {
            getCurrentScrollOffset: () => 0,
            getMaxScrollOffset: () => Math.max(0, getContentSize(ctx) - VIEWPORT),
            getScrollableNode: () => ({}),
            scrollTo: mock(() => {}),
        } as unknown as NonNullable<typeof ctx.state.refScroller.current>;
        contexts.push(ctx);
        return ctx;
    }

    for (const horizontal of [false, true]) {
        for (const footer of [0, 80]) {
            for (const padding of [0, 24]) {
                const label = `horizontal=${horizontal}, footer=${footer}, padding=${padding}`;

                describe(label, () => {
                    const endTarget: Target = {
                        index: LAST,
                        preserveForBottomPadding: true,
                        viewOffset: getEndAlignedViewOffset(padding, footer),
                        viewPosition: 1,
                    };

                    it("initialScrollAtEnd and a numeric last-row target both land on the content end", () => {
                        const atEnd = setup({
                            footer,
                            horizontal,
                            initialScroll: { ...endTarget, preserveForFooterLayout: true },
                            padding,
                        });
                        const numeric = setup({ footer, horizontal, initialScroll: endTarget, padding });
                        const end = getContentSize(atEnd) - VIEWPORT;

                        expect(resolveInitialScrollOffset(atEnd, atEnd.state.initialScroll!)).toBe(end);
                        expect(resolveInitialScrollOffset(numeric, numeric.state.initialScroll!)).toBe(end);
                    });

                    it("scrollToEnd lands on the same content end", () => {
                        const ctx = setup({ footer, horizontal, padding });
                        scrollToEnd(ctx, { animated: false });

                        expect(ctx.state.scrollingTo?.targetOffset).toBe(getContentSize(ctx) - VIEWPORT);
                    });

                    it("scrollToEnd applies a caller viewOffset once on top of the end", () => {
                        const ctx = setup({ footer, horizontal, padding });
                        scrollToEnd(ctx, { animated: false, viewOffset: -10 });

                        expect(ctx.state.scrollingTo?.targetOffset).toBe(getContentSize(ctx) - VIEWPORT + 10);
                    });

                    it("an explicit last-row alignment aligns the row and ignores the footer", () => {
                        const ctx = setup({
                            footer,
                            horizontal,
                            initialScroll: { index: LAST, viewOffset: 0, viewPosition: 1 },
                            padding,
                        });

                        expect(resolveInitialScrollOffset(ctx, ctx.state.initialScroll!)).toBe(
                            LAST * ROW - (VIEWPORT - ROW),
                        );
                    });

                    it("scrollToIndex on the last row aligns the row, not the footer", () => {
                        const ctx = setup({ footer, horizontal, padding });
                        scrollToIndex(ctx, { animated: false, index: LAST, viewPosition: 1 });

                        expect(ctx.state.scrollingTo?.targetOffset).toBe(LAST * ROW - (VIEWPORT - ROW));
                    });

                    it("a numeric target before the last row is unaffected by the footer", () => {
                        const ctx = setup({
                            footer,
                            horizontal,
                            initialScroll: { index: 3, viewOffset: 0 },
                            padding,
                        });

                        expect(resolveInitialScrollOffset(ctx, ctx.state.initialScroll!)).toBe(3 * ROW);
                    });

                    for (const viewPosition of [0, 0.5]) {
                        it(`last-row viewPosition=${viewPosition} is not shifted by the footer`, () => {
                            const ctx = setup({
                                footer,
                                horizontal,
                                initialScroll: { index: LAST, viewOffset: 0, viewPosition },
                                padding,
                            });

                            expect(resolveInitialScrollOffset(ctx, ctx.state.initialScroll!)).toBe(
                                Math.min(LAST * ROW - viewPosition * (VIEWPORT - ROW), getContentSize(ctx) - VIEWPORT),
                            );
                        });
                    }
                });
            }
        }
    }

    describe("retargeting numeric last-row targets", () => {
        const numericTarget = (viewOffset: number): Target => ({
            index: LAST,
            preserveForBottomPadding: true,
            viewOffset,
            viewPosition: 1,
        });

        it("keeps the footer in the target when the data changes but the row is still last", () => {
            const ctx = setup({ footer: 80, initialScroll: numericTarget(-24), padding: 24, session: true });

            handleBootstrapInitialScrollDataChange(ctx, {
                dataLength: ROWS,
                didDataChange: true,
                initialScrollAtEnd: false,
                previousDataLength: ROWS,
                stylePaddingEnd: 24,
            });

            expect(ctx.state.initialScroll).toMatchObject({ index: LAST, viewOffset: -104, viewPosition: 1 });
        });

        it("drops the footer once data grows past the target row", () => {
            const ctx = setup({
                footer: 80,
                initialScroll: numericTarget(-104),
                padding: 24,
                rows: ROWS + 4,
                session: true,
            });

            handleBootstrapInitialScrollDataChange(ctx, {
                dataLength: ROWS + 4,
                didDataChange: true,
                initialScrollAtEnd: false,
                previousDataLength: ROWS,
                stylePaddingEnd: 24,
            });

            expect(ctx.state.initialScroll).toMatchObject({ index: LAST, viewOffset: -24, viewPosition: 1 });
        });

        it("adds a late-measured footer to the target while bootstrap is active", () => {
            const ctx = setup({ footer: 0, initialScroll: numericTarget(-24), padding: 24, session: true });

            handleBootstrapInitialScrollFooterLayout(ctx, {
                dataLength: ROWS,
                footerSize: 80,
                initialScrollAtEnd: false,
                stylePaddingEnd: 24,
            });

            expect(ctx.state.initialScroll).toMatchObject({
                index: LAST,
                preserveForBottomPadding: true,
                viewOffset: -104,
                viewPosition: 1,
            });
        });

        it("keeps an out-of-range numeric index while adding the footer", () => {
            const ctx = setup({
                footer: 0,
                initialScroll: { ...numericTarget(0), index: 999 },
                session: true,
            });

            handleBootstrapInitialScrollFooterLayout(ctx, {
                dataLength: ROWS,
                footerSize: 80,
                initialScrollAtEnd: false,
                stylePaddingEnd: 0,
            });

            expect(ctx.state.initialScroll).toMatchObject({ index: 999, viewOffset: -80 });
        });

        it("ignores footer layout for a numeric target before the last row", () => {
            const target: Target = { index: 3, viewOffset: 0 };
            const ctx = setup({ footer: 0, initialScroll: target, session: true });

            handleBootstrapInitialScrollFooterLayout(ctx, {
                dataLength: ROWS,
                footerSize: 80,
                initialScrollAtEnd: false,
                stylePaddingEnd: 0,
            });

            expect(ctx.state.initialScroll).toBe(target);
        });

        it("ignores footer layout for an explicit last-row alignment", () => {
            const target: Target = { index: LAST, viewOffset: 0, viewPosition: 1 };
            const ctx = setup({ footer: 0, initialScroll: target, session: true });

            handleBootstrapInitialScrollFooterLayout(ctx, {
                dataLength: ROWS,
                footerSize: 80,
                initialScrollAtEnd: false,
                stylePaddingEnd: 0,
            });

            expect(ctx.state.initialScroll).toBe(target);
        });
    });
});
