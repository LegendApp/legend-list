import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from "bun:test";
import "../setup";

import * as initialScrollModule from "../../src/core/initialScroll";
import { handleInitialScrollDataChange } from "../../src/core/initialScrollLifecycle";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";

describe("initialScrollLifecycle", () => {
    let advanceInitialScrollSpy: Mock<typeof initialScrollModule.advanceInitialScroll>;

    beforeEach(() => {
        advanceInitialScrollSpy = spyOn(initialScrollModule, "advanceInitialScroll").mockImplementation(() => true);
    });

    afterEach(() => {
        advanceInitialScrollSpy.mockRestore();
    });

    it("replays finished offset-only initial scrolls when data arrives after an empty mount", () => {
        const ctx = createMockContext(
            {},
            {
                didFinishInitialScroll: true,
                initialScroll: {
                    contentOffset: 250,
                    index: 0,
                    viewOffset: 0,
                } as StateContext["state"]["initialScroll"],
                initialScrollUsesOffset: true,
                props: {
                    data: Array.from({ length: 5 }, (_, index) => ({ id: `item-${index}` })),
                },
                queuedInitialLayout: true,
            },
        );

        handleInitialScrollDataChange(ctx, {
            dataLength: ctx.state.props.data.length,
            didDataChange: true,
            initialScrollAtEnd: false,
            previousDataLength: 0,
            stylePaddingBottom: 0,
            useBootstrapInitialScroll: false,
        });

        expect(ctx.state.didFinishInitialScroll).toBe(false);
        expect(advanceInitialScrollSpy).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                waitForInitialLayout: undefined,
            }),
        );
    });
});
