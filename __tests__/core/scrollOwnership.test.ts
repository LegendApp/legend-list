import { describe, expect, it, mock } from "bun:test";

mock.module("@/constants-platform", () => ({
    IsNewArchitecture: true,
}));

import {
    canReconcileScrollWithMVCP,
    getScrollStabilityOwner,
    getScrollStabilityState,
    hasBootstrapScrollOwnership,
} from "../../src/core/scrollOwnership";
import { createMockState } from "../__mocks__/createMockState";

describe("scrollOwnership", () => {
    it("prefers bootstrap ownership while bootstrap is active", () => {
        const state = createMockState({
            didFinishInitialScroll: false,
            initialBootstrap: {
                commitStableFrames: 0,
                expectsObservedPlatformSettle: false,
                phase: "projecting",
                projectionOffset: 0,
                stableFrames: 0,
                target: {
                    indexHint: 2,
                    viewOffset: 0,
                    viewPosition: 0,
                },
            },
        });

        expect(hasBootstrapScrollOwnership(state)).toBe(true);
        expect(
            getScrollStabilityOwner(state, {
                allowDeferredGeometry: true,
                numColumns: 1,
            }),
        ).toBe("bootstrap");
    });

    it("prefers mvcp ownership over deferred geometry when mvcp is active", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            ignoreScrollFromMVCP: { lt: 20 } as any,
        });

        expect(
            getScrollStabilityState(state, {
                allowDeferredGeometry: true,
                numColumns: 1,
            }),
        ).toMatchObject({
            canUseDeferredGeometry: false,
            owner: "mvcp",
            supportsDeferredGeometry: true,
        });
    });

    it("uses deferred geometry ownership when the pass is eligible", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
        });

        expect(
            getScrollStabilityState(state, {
                allowDeferredGeometry: true,
                numColumns: 1,
            }),
        ).toMatchObject({
            canUseDeferredGeometry: true,
            owner: "deferred_geometry",
            supportsDeferredGeometry: true,
        });
    });

    it("keeps deferred geometry ownership for prepend transactions that opt into deferred stabilization", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            pendingPrependTransaction: {
                anchorIndex: 2,
                anchorKey: "item_2",
                anchorPosition: 200,
                estimatedInsertedTotal: 100,
                insertedKeys: new Set(["new-1"]),
                remainingKeys: new Set(["new-1"]),
                usesDeferredGeometry: true,
            },
        });

        expect(
            getScrollStabilityState(state, {
                allowDeferredGeometry: true,
                numColumns: 1,
            }),
        ).toMatchObject({
            canUseDeferredGeometry: true,
            owner: "deferred_geometry",
            supportsDeferredGeometry: true,
        });
    });

    it("keeps prepend transactions in mvcp ownership when they do not opt into deferred stabilization", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            pendingPrependTransaction: {
                anchorIndex: 2,
                anchorKey: "item_2",
                anchorPosition: 200,
                estimatedInsertedTotal: 100,
                insertedKeys: new Set(["new-1"]),
                remainingKeys: new Set(["new-1"]),
            },
        });

        expect(
            getScrollStabilityState(state, {
                allowDeferredGeometry: true,
                numColumns: 1,
            }),
        ).toMatchObject({
            canUseDeferredGeometry: false,
            owner: "mvcp",
            supportsDeferredGeometry: false,
        });
    });

    it("falls back to direct scroll when deferred geometry is disabled for the pass", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
        });

        expect(
            getScrollStabilityState(state, {
                allowDeferredGeometry: false,
                numColumns: 1,
            }),
        ).toMatchObject({
            canUseDeferredGeometry: false,
            owner: "direct_scroll",
            supportsDeferredGeometry: true,
        });
    });

    it("falls back to direct scroll when the layout is not eligible for deferred geometry", () => {
        const state = createMockState({
            didFinishInitialScroll: true,
            props: {
                horizontal: true,
            },
        });

        expect(
            getScrollStabilityState(state, {
                allowDeferredGeometry: true,
                numColumns: 1,
            }),
        ).toMatchObject({
            canUseDeferredGeometry: false,
            owner: "direct_scroll",
            supportsDeferredGeometry: false,
        });
    });

    it("only allows mvcp reconciliation for mvcp and direct-scroll owners", () => {
        expect(canReconcileScrollWithMVCP("bootstrap")).toBe(false);
        expect(canReconcileScrollWithMVCP("deferred_geometry")).toBe(false);
        expect(canReconcileScrollWithMVCP("mvcp")).toBe(true);
        expect(canReconcileScrollWithMVCP("direct_scroll")).toBe(true);
    });
});
