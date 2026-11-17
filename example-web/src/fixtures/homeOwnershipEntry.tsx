import { createRoot } from "react-dom/client";

import { LegendList, type LegendListRef } from "@legendapp/list/react";
import type { StateContext } from "../../../src/state/state";
import { useStateContext } from "../../../src/state/state";
import { requestAdjust } from "../../../src/utils/requestAdjust";

type TraceEvent = { at: number; kind: string; value: unknown };
const fixture = {
    adjust(delta: number, source?: "item-size" | "data") {
        requestAdjust(fixture.ctx!, delta, source);
    },
    ctx: undefined as StateContext | undefined,
    events: [] as TraceEvent[],
    list: null as LegendListRef | null,
    resizeFirstRows() {
        for (const [index, height] of [
            [0, 121],
            [1, 209],
        ]) {
            const row = document.querySelector<HTMLElement>(`[data-row="${index}"]`);
            if (row) row.style.height = `${height}px`;
        }
    },
};
Object.assign(window, { homeOwnership: fixture });
function Row({ index }: { index: number }) {
    fixture.ctx = useStateContext();
    return (
        <div data-row={index} style={{ height: [101, 185, 118, 65][index % 4] }}>
            Row {index}
        </div>
    );
}

const data = Array.from({ length: 450 }, (_, id) => ({ id }));
const renderItem = ({ index }: { index: number }) => <Row index={index} />;
createRoot(document.getElementById("root")!).render(
    <LegendList
        alignItemsAtEnd
        contentContainerStyle={{ paddingTop: 16 }}
        data={data}
        drawDistance={1000}
        estimatedItemSize={61}
        initialScrollAtEnd
        keyExtractor={(item) => String(item.id)}
        maintainScrollAtEnd={{ animated: false }}
        maintainVisibleContentPosition
        ref={(ref) => {
            fixture.list = ref;
        }}
        renderItem={renderItem}
        style={{ height: 799, width: 600 }}
    />,
);
