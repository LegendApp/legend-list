import { describe, expect, it } from "bun:test";
import { useInfiniteMode } from "../../src/hooks/useInfiniteMode";
import type { LegendListRenderItemProps, OnViewableItemsChangedInfo, ViewToken } from "../../src/types.base";
import TestRenderer, { act } from "../helpers/testRenderer";
import "../setup";

const KEY_SEPARATOR = "␟";

type Item = { id: string; label: string };

const makeItems = (count: number): Item[] =>
    Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, label: `Item ${i}` }));

type HookProps = Parameters<typeof useInfiniteMode<Item, any>>[0];
type HookResult = ReturnType<typeof useInfiniteMode<Item, any>>;

function renderInfiniteMode(
    props: Partial<HookProps> & { data: readonly Item[] },
    infiniteMode: boolean | { copies?: number } | undefined,
): HookResult {
    const fullProps = {
        renderItem: () => null,
        ...props,
    } as HookProps;

    let result: HookResult | undefined;
    function Probe() {
        result = useInfiniteMode<Item, HookProps>(fullProps, infiniteMode, null);
        return null;
    }

    act(() => {
        TestRenderer.create(<Probe />);
    });

    return result!;
}

describe("useInfiniteMode", () => {
    it("passes props through unchanged when disabled", () => {
        const data = makeItems(4);
        const renderItem = () => null;
        const { props } = renderInfiniteMode({ data, renderItem }, undefined);

        expect(props.data).toBe(data);
        expect(props.renderItem).toBe(renderItem);
    });

    it("passes props through unchanged for empty data", () => {
        const data: Item[] = [];
        const { props } = renderInfiniteMode({ data }, true);

        expect(props.data).toBe(data);
    });

    it("repeats data into an odd number of copies of at least 9", () => {
        const data = makeItems(8);
        const { props } = renderInfiniteMode({ data }, true);

        expect(props.data.length).toBe(8 * 9);
        expect(props.data[0]).toBe(data[0]);
        expect(props.data[8 * 5 + 3]).toBe(data[3]);
    });

    it("scales copies up for short datasets", () => {
        const { props } = renderInfiniteMode({ data: makeItems(2) }, true);

        // ceil(40 / 2) = 20, bumped to odd = 21
        expect(props.data.length).toBe(2 * 21);
    });

    it("bumps configured even copies to odd", () => {
        const { props } = renderInfiniteMode({ data: makeItems(4) }, { copies: 10 });

        expect(props.data.length).toBe(4 * 11);
    });

    it("keys each virtual copy uniquely with the real key as prefix", () => {
        const data = makeItems(4);
        const keyExtractor = (item: Item) => item.id;
        const { props } = renderInfiniteMode({ data, keyExtractor }, true);

        expect(props.keyExtractor!(data[1], 1)).toBe(`item-1${KEY_SEPARATOR}0`);
        expect(props.keyExtractor!(data[1], 5)).toBe(`item-1${KEY_SEPARATOR}1`);
        expect(props.keyExtractor!(data[1], 5)).not.toBe(props.keyExtractor!(data[1], 9));
    });

    it("maps virtual indices back to real indices in renderItem and adds infiniteIndex", () => {
        const data = makeItems(4);
        const received: LegendListRenderItemProps<Item>[] = [];
        const { props } = renderInfiniteMode(
            {
                data,
                renderItem: (itemProps: LegendListRenderItemProps<Item>) => {
                    received.push(itemProps);
                    return null;
                },
            },
            true,
        );

        props.renderItem({
            data: props.data,
            extraData: undefined,
            index: 4 * 5 + 2,
            item: data[2],
            type: undefined,
        } as LegendListRenderItemProps<Item, any>);

        expect(received).toHaveLength(1);
        expect(received[0].index).toBe(2);
        expect(received[0].infiniteIndex).toBe(4 * 5 + 2);
        expect(received[0].data).toBe(data);
    });

    it("starts scroll at the middle copy, offset by initialScrollIndex", () => {
        const data = makeItems(8);
        const middleCopyBase = 8 * Math.floor(9 / 2);

        expect(renderInfiniteMode({ data }, true).props.initialScrollIndex).toBe(middleCopyBase);
        expect(renderInfiniteMode({ data, initialScrollIndex: 2 }, true).props.initialScrollIndex).toBe(
            middleCopyBase + 2,
        );
        expect(
            renderInfiniteMode({ data, initialScrollIndex: { index: 3, viewOffset: 10 } }, true).props
                .initialScrollIndex,
        ).toEqual({
            index: middleCopyBase + 3,
            viewOffset: 10,
        });
    });

    it("wraps getItemType and getFixedItemSize with real indices", () => {
        const data = makeItems(4);
        const typeIndices: number[] = [];
        const sizeIndices: number[] = [];
        const { props } = renderInfiniteMode(
            {
                data,
                getFixedItemSize: (_item: Item, index: number) => {
                    sizeIndices.push(index);
                    return 100;
                },
                getItemType: (_item: Item, index: number) => {
                    typeIndices.push(index);
                    return "row";
                },
            },
            true,
        );

        props.getItemType!(data[3], 4 * 2 + 3);
        props.getFixedItemSize!(data[1], 4 * 7 + 1, "row");

        expect(typeIndices).toEqual([3]);
        expect(sizeIndices).toEqual([1]);
    });

    it("strips onStartReached and onEndReached", () => {
        const { props } = renderInfiniteMode(
            {
                data: makeItems(4),
                onEndReached: () => {},
                onStartReached: () => {},
            },
            true,
        );

        expect(props.onEndReached).toBeUndefined();
        expect(props.onStartReached).toBeUndefined();
    });

    it("maps viewability callbacks back to real indices and keys", () => {
        const data = makeItems(4);
        const received: OnViewableItemsChangedInfo<Item>[] = [];
        const { props } = renderInfiniteMode(
            {
                data,
                keyExtractor: (item: Item) => item.id,
                onViewableItemsChanged: (info: OnViewableItemsChangedInfo<Item>) => {
                    received.push(info);
                },
            },
            true,
        );

        const virtualToken: ViewToken<Item> = {
            containerId: 0,
            index: 4 * 5 + 1,
            isViewable: true,
            item: data[1],
            key: `item-1${KEY_SEPARATOR}5`,
        };
        props.onViewableItemsChanged!({
            changed: [virtualToken],
            end: 4 * 5 + 2,
            endBuffered: 4 * 5 + 3,
            start: 4 * 5 + 1,
            startBuffered: 4 * 5,
            viewableItems: [virtualToken],
        });

        expect(received).toHaveLength(1);
        expect(received[0].viewableItems[0].index).toBe(1);
        expect(received[0].viewableItems[0].key).toBe("item-1");
        expect(received[0].start).toBe(1);
        expect(received[0].end).toBe(2);
    });
});
