import "../setup";

import { updateItemPositions } from "../../src/core/updateItemPositions";
import type { StateContext } from "../../src/state/state";
import { createMockContext } from "../__mocks__/createMockContext";
import { createCurrentLayoutReader } from "../helpers/currentLayoutReader";
import type { CreateLayoutReaderHarness } from "../helpers/layoutReaderContract";
import { runLayoutReaderContract } from "../helpers/layoutReaderContract";

function createItems(count: number) {
    return Array.from({ length: count }, (_, index) => ({ id: `item-${index}` }));
}

const createCurrentLayoutHarness: CreateLayoutReaderHarness = ({ estimatedItemSize = 100, sizes }) => {
    const ctx = createMockContext(
        {
            numColumns: 1,
            totalSize: 0,
        },
        {
            props: {
                data: createItems(sizes.length),
                estimatedItemSize,
                keyExtractor: (item: { id: string }) => item.id,
            },
            totalSize: 0,
        },
    );

    sizes.forEach((size, index) => {
        if (size !== undefined) {
            ctx.state.sizesKnown.set(`item-${index}`, size);
        }
    });

    return {
        reader: createCurrentLayoutReader(ctx),
        setMeasuredSize(index, size) {
            ctx.state.sizesKnown.set(`item-${index}`, size);
        },
        updateFrom(startIndex = 0) {
            updateFrom(ctx, startIndex);
        },
    };
};

function updateFrom(ctx: StateContext, startIndex = 0) {
    updateItemPositions(ctx, false, {
        doMVCP: false,
        scrollBottomBuffered: -1,
        startIndex,
    });
}

runLayoutReaderContract("current layout reader", createCurrentLayoutHarness);
