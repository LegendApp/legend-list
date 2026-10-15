import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import "../setup";

import { cancelImperativeScroll } from "@/core/cancelImperativeScroll";
import { interruptMaintainScrollAtEnd } from "@/core/doMaintainScrollAtEnd";
import { Platform } from "@/platform/Platform";
import {
    createWebScrollHarness,
    flushMicrotasks,
    trackScroll,
    type WebScrollHarness,
} from "../helpers/webScrollHarness";

let harness: WebScrollHarness | undefined;

beforeEach(() => {
    Platform.OS = "web";
    harness = createWebScrollHarness();
});

afterEach(() => {
    harness?.restore();
    harness = undefined;
});

describe("imperative scroll results", () => {
    it("resolves a landed scroll with undefined", async () => {
        const h = harness!;
        const scroll = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 1200 }));

        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();

        expect(scroll.resolved).toBe(true);
        expect(scroll.value).toBeUndefined();
        expect(h.browser.offset).toBe(1200);
    });

    it("resolves a superseded scrollToIndex with reason superseded and lands the newer one", async () => {
        const h = harness!;
        const first = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
        h.browser.step(400);

        const second = trackScroll(h.ref.scrollToOffset({ animated: true, offset: 300 }));
        await flushMicrotasks();
        expect(first.resolved).toBe(true);
        expect(first.value).toEqual({ reason: "superseded" });
        expect(second.resolved).toBe(false);

        h.browser.runToEnd();
        h.clock.advance(100);
        await flushMicrotasks();
        expect(second.resolved).toBe(true);
        expect(second.value).toBeUndefined();
        expect(h.browser.offset).toBe(300);
    });

    it("resolves a scroll waiting for data to settle as superseded when replaced", async () => {
        const h = harness!;
        h.state.didDataChange = true;
        const first = trackScroll(h.ref.scrollToIndex({ animated: true, index: 20 }));
        const second = trackScroll(h.ref.scrollToIndex({ animated: true, index: 30 }));
        await flushMicrotasks();

        expect(first.value).toEqual({ reason: "superseded" });
        expect(second.resolved).toBe(false);
    });

    it("resolves with reason interrupted when user input stops an end-follow scroll", async () => {
        const h = harness!;
        const scroll = trackScroll(h.ref.scrollToEnd({ animated: true }));
        h.clock.tick();
        h.state.maintainingScrollAtEnd = "animated";
        h.browser.step(400);

        expect(interruptMaintainScrollAtEnd(h.ctx)).toBe(true);
        await flushMicrotasks();
        expect(scroll.value).toEqual({ reason: "interrupted" });
    });

    it("resolves an active scroll as superseded when the list cancels it on unmount", async () => {
        const h = harness!;
        const scroll = trackScroll(h.ref.scrollToIndex({ animated: true, index: 50 }));
        h.browser.step(400);

        cancelImperativeScroll(h.state);
        await flushMicrotasks();
        expect(scroll.value).toEqual({ reason: "superseded" });
        expect(scroll.rejected).toBe(false);
    });
});
