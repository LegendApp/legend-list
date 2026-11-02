import { describe, expect, it } from "bun:test";
import "../setup";

import { setFooterSize } from "../../src/core/updateContentMetrics";
import { checkThresholds } from "../../src/utils/checkThresholds";
import { beginReachedEdgeUserScroll, prepareReachedEdgeForNextUserScroll } from "../../src/utils/edgeReachedGate";
import { createMockContext } from "../__mocks__/createMockContext";

describe("empty page edge re-arm", () => {
    for (const edge of ["end", "start"] as const) {
        it(`${edge}: retries an empty page once on a new gesture without a size change`, () => {
            const calls: number[] = [];
            const ctx = createMockContext(
                { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 128 },
                {
                    props: {
                        data: [{ id: "0" }, { id: "1" }],
                        onEndReached: edge === "end" ? () => calls.push(ctx.state.props.data.length) : undefined,
                        onStartReached: edge === "start" ? () => calls.push(ctx.state.props.data.length) : undefined,
                    },
                    queuedInitialLayout: true,
                    scrollLength: 800,
                },
            );
            try {
                checkThresholds(ctx);
                ctx.state.props.data = [...ctx.state.props.data];
                checkThresholds(ctx);
                expect(calls).toEqual([2]);

                prepareReachedEdgeForNextUserScroll(ctx);
                checkThresholds(ctx, beginReachedEdgeUserScroll(ctx, edge === "end" ? 1 : -1));
                checkThresholds(ctx, beginReachedEdgeUserScroll(ctx, edge === "end" ? 1 : -1));
                checkThresholds(ctx);
                expect(calls).toEqual([2, 2]);
            } finally {
                ctx.state.scheduledWork.dispose();
            }
        });
        for (const gesture of [false, true]) {
            it(`${edge}: re-pages twice after empty pages (new gesture: ${gesture})`, () => {
                const calls: number[] = [];
                const ctx = createMockContext(
                    { footerSize: 0, headerSize: 0, stylePaddingTop: 0, totalSize: 128 },
                    {
                        props: {
                            data: [{ id: "0" }, { id: "1" }],
                            onEndReached: edge === "end" ? () => calls.push(ctx.state.props.data.length) : undefined,
                            onStartReached:
                                edge === "start" ? () => calls.push(ctx.state.props.data.length) : undefined,
                        },
                        queuedInitialLayout: true,
                        scrollLength: 800,
                    },
                );
                try {
                    checkThresholds(ctx);
                    expect(calls).toEqual([2]);
                    for (const footerSize of [15, 0]) {
                        // A live cursor returns no rows; the consumer replaces data and its loading footer.
                        ctx.state.props.data = [...ctx.state.props.data];
                        setFooterSize(ctx, footerSize);
                        if (gesture) {
                            prepareReachedEdgeForNextUserScroll(ctx);
                            checkThresholds(ctx, beginReachedEdgeUserScroll(ctx, edge === "end" ? 1 : -1));
                        }
                        checkThresholds(ctx);
                        checkThresholds(ctx);
                    }
                    expect(calls).toEqual([2, 2, 2]);
                } finally {
                    ctx.state.scheduledWork.dispose();
                }
            });
        }
    }
});
