import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import type { ScrollAdjustHandler } from "../../src/core/ScrollAdjustHandler";
import type { StateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types";
import TestRenderer, { act } from "../helpers/testRenderer";

let lastListProps: any;
let scrollToIndexCalls: any[] = [];
const handlerInstances: ScrollAdjustHandler[] = [];

function registerImperativeScrollMocks() {
    mock.module("@/components/ListComponent", () => ({
        ListComponent: (props: any) => {
            lastListProps = props;
            return null;
        },
    }));

    mock.module("@/core/ScrollAdjustHandler", () => {
        return {
            ScrollAdjustHandler: class {
                context: StateContext;
                appliedAdjust = 0;
                pendingAdjust = 0;
                mounted = false;
                constructor(ctx: StateContext) {
                    this.context = ctx;
                    handlerInstances.push(this as any);
                }
                requestAdjust() {}
                setMounted() {
                    this.mounted = true;
                }
                getAdjust() {
                    return this.appliedAdjust;
                }
                commitPendingAdjust() {}
            },
        };
    });

    mock.module("@/core/scrollToIndex", () => ({
        scrollToIndex: (_ctx: unknown, params: any) => {
            scrollToIndexCalls.push(params);
        },
    }));
}

function createData(length: number) {
    return Array.from({ length }, (_value, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
    }));
}

async function flushAsync() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function getStateFromRender() {
    for (let i = 0; i < 5; i++) {
        const handler = lastListProps?.scrollAdjustHandler ?? handlerInstances.at(-1);
        if (handler) {
            return (handler as any).context.state as StateContext["state"];
        }
        await flushAsync();
    }
    throw new Error("scrollAdjustHandler not found after retries");
}

beforeEach(() => {
    registerImperativeScrollMocks();
    handlerInstances.length = 0;
    lastListProps = undefined;
    scrollToIndexCalls = [];
});

describe("LegendList imperative scrolls", () => {
    it("resolves scrollToEnd against data committed after the imperative call", async () => {
        const { LegendList } = await import("../../src/components/LegendList?imperative-scroll-commit");
        let sendMessage: () => void = () => {};

        function Harness() {
            const [data, setData] = React.useState(() => createData(2));
            const listRef = React.useRef<LegendListRef>(null);

            sendMessage = () => {
                setData((current) => [...current, { id: `item-${current.length}`, label: `Item ${current.length}` }]);
                listRef.current?.scrollToEnd({ animated: false });
            };

            return (
                <LegendList
                    data={data}
                    estimatedItemSize={50}
                    getFixedItemSize={() => 50}
                    keyExtractor={(item: { id: string }) => item.id}
                    recycleItems={false}
                    ref={listRef}
                    renderItem={() => null}
                />
            );
        }

        let renderer: ReturnType<typeof TestRenderer.create> | undefined;
        await act(async () => {
            renderer = TestRenderer.create(<Harness />);
        });
        const state = await getStateFromRender();
        expect(state.props.data.length).toBe(2);

        await act(async () => {
            sendMessage();
        });

        expect(state.props.data.length).toBe(3);
        expect(scrollToIndexCalls).toEqual([
            expect.objectContaining({
                animated: false,
                index: 2,
                viewPosition: 1,
            }),
        ]);

        await act(async () => {
            renderer?.unmount();
        });
    });
});
