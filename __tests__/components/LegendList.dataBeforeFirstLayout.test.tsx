import { Text } from "react-native";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { POSITION_OUT_OF_VIEW } from "../../src/constants";
import { useArr$ } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";
import { registerBaseModuleMocks } from "../setup";

const ITEM_SIZE = 64;
const ITEM_COUNT = 10;

type Item = { id: string };

let lastListProps: any;

function PositionedContainer({ id }: { id: number }) {
    const [itemKey, position] = useArr$([`containerItemKey${id}`, `containerPosition${id}`]);

    return itemKey === undefined ? null : <Text>{`${itemKey}@${position ?? POSITION_OUT_OF_VIEW}`}</Text>;
}

function PositionListComponent(props: any) {
    lastListProps = props;
    const [numContainersPooled = 0] = useArr$(["numContainersPooled"]);

    if (!props.canRender) {
        return null;
    }

    return (
        <>
            {Array.from({ length: numContainersPooled }, (_, id) => (
                <PositionedContainer id={id} key={id} />
            ))}
        </>
    );
}

function getItems(count: number): Item[] {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }));
}

function getRenderedPositions(renderer: TestRenderer.ReactTestRenderer) {
    const positions = new Map<string, number>();
    for (const node of renderer.root.findAllByType(Text)) {
        const [key, position] = String(node.props.children).split("@");
        positions.set(key!, Number(position));
    }
    return positions;
}

async function flushFrames(count = 4) {
    for (let i = 0; i < count; i++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
    }
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    mock.module("@/components/ListComponent", () => ({
        ListComponent: PositionListComponent,
    }));
    lastListProps = undefined;
});

afterEach(() => {
    lastListProps = undefined;
});

describe("LegendList data change before first layout", () => {
    it("positions every item when data changes before the first non-zero layout", async () => {
        const { LegendList } = await import("../../src/components/LegendList?data-before-first-layout");
        const renderList = (data: Item[]) => (
            <LegendList
                data={data}
                estimatedItemSize={ITEM_SIZE}
                keyExtractor={(item: Item) => item.id}
                recycleItems
                renderItem={({ item }: { item: Item }) => <Text>{item.id}</Text>}
            />
        );

        let renderer!: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(renderList(getItems(1)));
        });
        // Cached data arrives while the parent, like a bottom sheet body, has not been laid out yet.
        await act(async () => {
            renderer.update(renderList(getItems(ITEM_COUNT)));
        });
        await act(async () => {
            lastListProps.onLayout({ nativeEvent: { layout: { height: 687, width: 402, x: 0, y: 0 } } });
        });
        await flushFrames();

        const positions = getRenderedPositions(renderer);
        expect(getItems(ITEM_COUNT).map((item) => positions.get(item.id))).toEqual(
            getItems(ITEM_COUNT).map((_item, index) => index * ITEM_SIZE),
        );

        await act(async () => {
            renderer.unmount();
        });
    });
});
