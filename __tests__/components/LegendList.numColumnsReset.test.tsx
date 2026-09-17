import { Fragment, StrictMode } from "react";
import { Text } from "react-native";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { calculateItemsInView } from "../../src/core/calculateItemsInView";
import { doMaintainScrollAtEnd } from "../../src/core/doMaintainScrollAtEnd";
import type { StateContext } from "../../src/state/state";
import { checkThresholds } from "../../src/utils/checkThresholds";
import { act, render } from "../helpers/testingLibrary";
import { registerBaseModuleMocks } from "../setup";

let checkResetContainersCalls: Array<{ didColumnsChange: boolean; numColumns: number | undefined }> = [];

function callThroughCheckResetContainers(
    ctx: StateContext,
    dataProp: readonly unknown[],
    { didColumnsChange = false }: { didColumnsChange?: boolean } = {},
) {
    const state = ctx.state;
    const { previousData } = state;
    const { maintainScrollAtEnd } = state.props;

    if (didColumnsChange) {
        state.sizes.clear();
        state.sizesKnown.clear();
        for (const key in state.averageSizes) {
            delete state.averageSizes[key];
        }
        state.scrollForNextCalculateItemsInView = undefined;
    }

    calculateItemsInView(ctx, { dataChanged: true, doMVCP: true });

    const shouldMaintainScrollAtEnd = !didColumnsChange && maintainScrollAtEnd?.onDataChange;
    const didMaintainScrollAtEnd = shouldMaintainScrollAtEnd && doMaintainScrollAtEnd(ctx);

    if (!didMaintainScrollAtEnd && previousData && dataProp.length > previousData.length) {
        state.isEndReached = false;
    }

    if (!didMaintainScrollAtEnd) {
        checkThresholds(ctx);
    }

    delete state.previousData;
}

function registerLegendListMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (_props: any) => null,
    }));

    mock.module("@/core/ScrollAdjustHandler", () => ({
        ScrollAdjustHandler: class {
            context: StateContext;

            constructor(ctx: StateContext) {
                this.context = ctx;
            }

            requestAdjust() {}
            setMounted() {}
            getAdjust() {
                return 0;
            }
            commitPendingAdjust() {}
        },
    }));

    mock.module("@/core/checkResetContainers", () => ({
        checkResetContainers: (
            ctx: StateContext,
            data: readonly unknown[],
            options?: { didColumnsChange?: boolean },
        ) => {
            checkResetContainersCalls.push({
                didColumnsChange: !!options?.didColumnsChange,
                numColumns: ctx.values.get("numColumns"),
            });
            callThroughCheckResetContainers(ctx, data, options);
        },
    }));
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    registerLegendListMocks();
    checkResetContainersCalls = [];
});

describe("LegendList numColumns reset", () => {
    it.each([
        { mode: "normal", Wrapper: Fragment },
        { mode: "Strict Mode", Wrapper: StrictMode },
    ])("updates column layout after a mounted column count changes in $mode", async ({ Wrapper }) => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?num-columns-reset");

        const keyExtractor = (item: { id: string }) => item.id;
        const list = (numColumns: number) => (
            <Wrapper>
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={keyExtractor}
                    numColumns={numColumns}
                    recycleItems
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />
            </Wrapper>
        );
        const rendered = render(list(2));

        await flushAsync();
        checkResetContainersCalls = [];
        rendered.rerender(list(3));
        await flushAsync();

        expect(checkResetContainersCalls).toContainEqual({ didColumnsChange: true, numColumns: 3 });
        rendered.unmount();
    });
});
