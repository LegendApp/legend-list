import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import { Text } from "react-native";

import TestRenderer from "../helpers/testRenderer";

let getItemSizeCallCount = 0;

interface UpdateItemPositionsPerfTotals {
    calls: number;
    dataChangedCalls: number;
    itemsVisited: number;
}

interface MountPerfMetrics {
    fullListPasses: number;
    perfCalls: number;
    perfDataChangedCalls: number;
    perfItemsVisited: number;
    sizeLookupCalls: number;
}

mock.module("@/utils/getItemSize", () => ({
    getItemSize: () => {
        getItemSizeCallCount += 1;
        return 100;
    },
}));

function createData(length: number) {
    return Array.from({ length }, (_value, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
    }));
}

function setPerfProfiling(enabled: boolean) {
    (globalThis as unknown as Record<string, unknown>).__LEGEND_LIST_PROFILE_UPDATE_ITEM_POSITIONS__ = enabled
        ? { enabled: true, logEvery: Number.MAX_SAFE_INTEGER, onlyDataChanged: true }
        : false;
}

function resetPerfTotals() {
    (globalThis as unknown as Record<string, unknown>).__LEGEND_LIST_PROFILE_UPDATE_ITEM_POSITIONS_TOTALS__ = undefined;
}

function readPerfTotals(): UpdateItemPositionsPerfTotals {
    const totals = (globalThis as unknown as Record<string, unknown>)
        .__LEGEND_LIST_PROFILE_UPDATE_ITEM_POSITIONS_TOTALS__ as UpdateItemPositionsPerfTotals | undefined;
    return (
        totals ?? {
            calls: 0,
            dataChangedCalls: 0,
            itemsVisited: 0,
        }
    );
}

async function mountAndMeasure(length: number): Promise<MountPerfMetrics> {
    setPerfProfiling(true);
    resetPerfTotals();
    getItemSizeCallCount = 0;
    const data = createData(length);
    const { LegendList } = await import("../../src/components/LegendList?mount-performance-test");

    const renderer = TestRenderer.create(
        <LegendList
            data={data}
            estimatedItemSize={100}
            keyExtractor={(item: { id: string }) => item.id}
            renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
        />,
    );

    const perfTotals = readPerfTotals();
    const callCount = getItemSizeCallCount;
    renderer.unmount();

    const fullListPasses = length > 0 ? perfTotals.itemsVisited / length : 0;

    console.info(
        `[legend-list][test:mount-performance] dataLength=${length} sizeLookups=${callCount} perfCalls=${perfTotals.calls} itemsVisited=${perfTotals.itemsVisited} fullListPasses=${fullListPasses.toFixed(
            2,
        )}`,
    );

    return {
        fullListPasses,
        perfCalls: perfTotals.calls,
        perfDataChangedCalls: perfTotals.dataChangedCalls,
        perfItemsVisited: perfTotals.itemsVisited,
        sizeLookupCalls: callCount,
    };
}

describe("LegendList mount performance", () => {
    beforeEach(() => {
        getItemSizeCallCount = 0;
        setPerfProfiling(true);
        resetPerfTotals();
    });

    it("keeps first-mount sizing work bounded when list length grows", async () => {
        const shortList = await mountAndMeasure(40);
        const longList = await mountAndMeasure(4000);

        // Expected behavior after optimization:
        // mount-time sizing should primarily depend on viewport/buffer, not total list length.
        expect(longList.sizeLookupCalls).toBeLessThanOrEqual(shortList.sizeLookupCalls + 120);

        // Diagnostic checks: capture how many full-list passes happen during mount.
        expect(longList.fullListPasses).toBeGreaterThanOrEqual(1);
        expect(longList.fullListPasses).toBeLessThanOrEqual(1.1);
        expect(longList.perfDataChangedCalls).toBeGreaterThanOrEqual(1);
    });

    it("avoids doing mount-time size lookups for deep tail items", async () => {
        const longList = await mountAndMeasure(2000);

        // Expected behavior after optimization:
        // first mount should not run size resolution once per item in long lists.
        expect(longList.sizeLookupCalls).toBeLessThanOrEqual(300);

        // Diagnostic check: track if this path still performs full-list passes.
        expect(longList.fullListPasses).toBeGreaterThanOrEqual(1);
    });
});
