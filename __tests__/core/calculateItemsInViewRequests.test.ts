import { describe, expect, it } from "bun:test";

import {
    getDataChangeReconcileRequest,
    getLayoutReconcileRequest,
    getScrollUpdateRequest,
} from "../../src/core/calculateItemsInViewRequests";

describe("calculateItemsInViewRequests", () => {
    it("builds an explicit data-change reconcile request", () => {
        expect(getDataChangeReconcileRequest()).toEqual({
            dataChanged: true,
            doMVCP: true,
        });
    });

    it("builds an explicit layout reconcile request", () => {
        expect(getLayoutReconcileRequest()).toEqual({
            doMVCP: true,
        });
    });

    it("only requests mvcp on scroll updates while a scroll target is active", () => {
        expect(getScrollUpdateRequest({ scrollingTo: undefined })).toEqual({
            doMVCP: false,
        });
        expect(getScrollUpdateRequest({ scrollingTo: { offset: 100 } as any })).toEqual({
            doMVCP: true,
        });
    });
});
