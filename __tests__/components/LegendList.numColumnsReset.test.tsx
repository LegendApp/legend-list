import { Text } from "react-native";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { StateContext } from "../../src/state/state";
import { act, render } from "../helpers/testingLibrary";
import { registerBaseModuleMocks } from "../setup";

let checkResetContainersCalls: Array<{ didColumnsChange: boolean; numColumns: number | undefined }> = [];

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
            _data: readonly unknown[],
            options?: { didColumnsChange?: boolean },
        ) => {
            checkResetContainersCalls.push({
                didColumnsChange: !!options?.didColumnsChange,
                numColumns: ctx.values.get("numColumns"),
            });
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
    it("updates numColumns before the column-change reset runs", async () => {
        const data = [
            { id: "item-1", label: "Alpha" },
            { id: "item-2", label: "Beta" },
            { id: "item-3", label: "Gamma" },
        ];
        const { LegendList } = await import("../../src/components/LegendList?num-columns-reset");

        const rendered = render(
            <LegendList
                data={data}
                estimatedItemSize={100}
                keyExtractor={(item: { id: string }) => item.id}
                numColumns={2}
                renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
            />,
        );

        await flushAsync();
        checkResetContainersCalls = [];

        await act(async () => {
            rendered.rerender(
                <LegendList
                    data={data}
                    estimatedItemSize={100}
                    keyExtractor={(item: { id: string }) => item.id}
                    numColumns={3}
                    renderItem={({ item }: { item: { label: string } }) => <Text>{item.label}</Text>}
                />,
            );
        });
        await flushAsync();

        expect(checkResetContainersCalls).toContainEqual({ didColumnsChange: true, numColumns: 3 });

        rendered.unmount();
    });
});
