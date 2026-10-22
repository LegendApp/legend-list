import { afterEach, describe, expect, it, spyOn } from "bun:test";
import "../setup";

import { prepareMVCP } from "@/core/mvcp";
import { Platform } from "@/platform/Platform";
import { normalizeMaintainVisibleContentPosition } from "@/utils/normalizeMaintainVisibleContentPosition";
import * as requestAdjustModule from "@/utils/requestAdjust";
import { createMockContext } from "../__mocks__/createMockContext";

const originalPlatform = Platform.OS;

describe("Android item-resize end clamping", () => {
    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it.each([
        { adjustment: 0, offset: 700, target: 650 },
        { adjustment: -20, offset: 680, target: 630 },
        { adjustment: -50, offset: 600, target: 550 },
    ])("preserves the reader anchor from offset $offset after a shrink", ({ adjustment, offset, target }) => {
        Platform.OS = "android";
        const ctx = createResizeContext(offset);
        const requestAdjust = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjust = prepareMVCP(ctx, false, "item-size");
            ctx.state.positions[2] -= 50;
            ctx.state.totalSize -= 50;
            adjust?.();

            expect(ctx.state.scroll).toBe(target);
            expect(ctx.state.pendingNativeMVCPAdjust).toBeUndefined();
            if (offset > 650) expect(ctx.state.scrollPending).toBe(650);
            if (adjustment === 0) {
                expect(requestAdjust).not.toHaveBeenCalled();
            } else {
                expect(requestAdjust).toHaveBeenCalledWith(ctx, adjustment, "item-size");
            }
        } finally {
            requestAdjust.mockRestore();
            ctx.state.scheduledWork.dispose();
        }
    });

    it("keeps a fully collapsed list at zero without another anchor adjustment", () => {
        Platform.OS = "android";
        const ctx = createResizeContext(700);
        const requestAdjust = spyOn(requestAdjustModule, "requestAdjust");
        try {
            const adjust = prepareMVCP(ctx, false, "item-size");
            ctx.state.positions[1] = 0;
            ctx.state.positions[2] = 0;
            ctx.state.totalSize = 200;
            adjust?.();

            expect(ctx.state.scroll).toBe(0);
            expect(ctx.state.scrollPending).toBe(0);
            expect(requestAdjust).not.toHaveBeenCalled();
        } finally {
            requestAdjust.mockRestore();
            ctx.state.scheduledWork.dispose();
        }
    });

    it("keeps the native data-change handoff separate from item resizing", () => {
        Platform.OS = "android";
        const ctx = createResizeContext(700);
        try {
            const adjust = prepareMVCP(ctx, true, "data");
            ctx.state.positions[2] -= 50;
            ctx.state.totalSize -= 50;
            adjust?.();

            expect(ctx.state.scroll).toBe(700);
            expect(ctx.state.pendingNativeMVCPAdjust?.amount).toBe(-50);
        } finally {
            ctx.state.scheduledWork.dispose();
        }
    });

    for (const platform of ["ios", "web"] as const) {
        it(`retains the existing item-size adjustment on ${platform}`, () => {
            Platform.OS = platform;
            const ctx = createResizeContext(700);
            const requestAdjust = spyOn(requestAdjustModule, "requestAdjust");
            try {
                const adjust = prepareMVCP(ctx, false, "item-size");
                ctx.state.positions[2] -= 50;
                ctx.state.totalSize -= 50;
                adjust?.();

                expect(requestAdjust).toHaveBeenCalledWith(ctx, -50, "item-size");
                expect(ctx.state.scroll).toBe(650);
                expect(ctx.state.scrollPending).toBe(700);
            } finally {
                requestAdjust.mockRestore();
                ctx.state.scheduledWork.dispose();
            }
        });
    }
});

function createResizeContext(scroll: number) {
    return createMockContext(
        { readyToRender: true, totalSize: 1000 },
        {
            didContainersLayout: true,
            didFinishInitialScroll: true,
            idCache: ["item-0", "item-1", "item-2"],
            idsInView: ["item-2"],
            indexByKey: new Map([
                ["item-0", 0],
                ["item-1", 1],
                ["item-2", 2],
            ]),
            positions: [0, 200, 800],
            props: {
                data: [{ id: 0 }, { id: 1 }, { id: 2 }],
                keyExtractor: (item: { id: number }) => `item-${item.id}`,
                maintainVisibleContentPosition: normalizeMaintainVisibleContentPosition(true),
            },
            scroll,
            scrollLength: 300,
            scrollPending: scroll,
        },
    );
}
