import { getExpandedContainerPoolSize, getInitialContainerPoolSize } from "@/utils/containerPool";
import { describe, expect, it } from "bun:test";

describe("containerPool", () => {
    describe("getInitialContainerPoolSize", () => {
        it("returns 0 when there is no data or no active containers", () => {
            expect(getInitialContainerPoolSize(0, 10)).toBe(0);
            expect(getInitialContainerPoolSize(10, 0)).toBe(0);
        });

        it("keeps the initial pool at least as large as the active container count", () => {
            expect(getInitialContainerPoolSize(100, 20)).toBe(60);
            expect(getInitialContainerPoolSize(10, 20)).toBe(20);
        });

        it("allocates a small spare pool when data length allows it", () => {
            expect(getInitialContainerPoolSize(100, 6)).toBe(32);
            expect(getInitialContainerPoolSize(20, 6)).toBe(20);
        });

        it("uses the automatic multiplier without exceeding useful capacity", () => {
            expect(getInitialContainerPoolSize(100, 20)).toBe(60);
            expect(getInitialContainerPoolSize(50, 20)).toBe(50);
        });

        it("caps spare initial slots for large active container windows", () => {
            expect(getInitialContainerPoolSize(1_000, 80)).toBe(144);
            expect(getInitialContainerPoolSize(1_000, 120)).toBe(184);
        });
    });

    describe("getExpandedContainerPoolSize", () => {
        it("returns 0 when there is no data or no active containers", () => {
            expect(getExpandedContainerPoolSize(0, 10)).toBe(0);
            expect(getExpandedContainerPoolSize(10, 0)).toBe(0);
        });

        it("grows by 50 percent when there is enough data", () => {
            expect(getExpandedContainerPoolSize(100, 20)).toBe(30);
        });

        it("caps expansion to the useful container count", () => {
            expect(getExpandedContainerPoolSize(25, 20)).toBe(25);
            expect(getExpandedContainerPoolSize(5, 20)).toBe(20);
        });
    });
});
