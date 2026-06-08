import { useMemo, useRef, useState } from "react";

import { LegendList, type LegendListRef } from "@legendapp/list/react";

/**
 * Reproducible sandbox for the LegendList open-scroll jump on prepend.
 *
 * The item heights and the list rect below were captured from a real app
 * (a conversation that exhibits a scroll jump when older messages load). The
 * list is positioned at the exact same screen geometry so the configuration
 * matches.
 *
 * Repro:
 *  1. Tap "Remount" — list opens at the last item of the initial page.
 *  2. Tap "Load older" — the older items are prepended.
 *
 * Expected: with `maintainVisibleContentPosition`, the currently visible row
 * should stay put when older items are prepended.
 * Bug: the scroll position is NOT maintained on that prepend.
 */
const ITEM_HEIGHTS = [
    { height: 48.09027862548828, index: 0, width: 818.3333740234375 },
    { height: 45.659725189208984, index: 1, width: 818.3333740234375 },
    { height: 37.65625, index: 2, width: 818.3333740234375 },
    { height: 37.65625, index: 3, width: 818.3333740234375 },
    { height: 37.65625, index: 4, width: 818.3333740234375 },
    { height: 37.65625, index: 5, width: 818.3333740234375 },
    { height: 37.65625, index: 6, width: 818.3333740234375 },
    { height: 37.65625, index: 7, width: 818.3333740234375 },
    { height: 37.65625, index: 8, width: 818.3333740234375 },
    { height: 37.65625, index: 9, width: 818.3333740234375 },
    { height: 37.65625, index: 10, width: 818.3333740234375 },
    { height: 37.65625, index: 11, width: 818.3333740234375 },
    { height: 425.9895935058594, index: 12, width: 818.3333740234375 },
    { height: 68.54167175292969, index: 13, width: 818.3333740234375 },
    { height: 37.65625, index: 14, width: 818.3333740234375 },
    { height: 48.09027862548828, index: 15, width: 818.3333740234375 },
    { height: 434.8871765136719, index: 16, width: 818.3333740234375 },
    { height: 48.09027862548828, index: 17, width: 818.3333740234375 },
    { height: 68.54167175292969, index: 18, width: 818.3333740234375 },
    { height: 37.65625, index: 19, width: 818.3333740234375 },
].map((it) => it.height);

const LIST_RECT = {
    height: 817.9166870117188,
    width: 1218.3333740234375,
    x: 460.5555725097656,
    y: 49.548614501953125,
};

interface Item {
    id: string;
    index: number;
    height: number;
}

const DATA: Array<Item> = ITEM_HEIGHTS.map((height, index) => ({
    height,
    id: `item-${index}`,
    index,
}));

// We first show only the last N items (the "last page"), then prepend the
// older ones — mirroring how the app opens at the end and then loads older
// messages. The bug appears on that prepend (MVCP re-anchoring).
const INITIAL_COUNT = 13;
const INITIAL_LAST_INDEX = INITIAL_COUNT - 1;

export default function PrependMvcpJumpExample() {
    const listRef = useRef<LegendListRef>(null);
    // Remounting re-triggers the initial open; showAll prepends the older items.
    const [mountKey, setMountKey] = useState(0);
    const [showAll, setShowAll] = useState(false);

    // Mirror the app workaround: items get fresh refs so LegendList re-renders.
    // https://github.com/LegendApp/legend-list/issues/455
    const visibleData = useMemo(() => {
        const slice = showAll ? DATA : DATA.slice(-INITIAL_COUNT);
        return slice.map((item) => ({ ...item }));
    }, [showAll, mountKey]);

    const remount = () => {
        setShowAll(false);
        setMountKey((key) => key + 1);
    };

    return (
        <div style={{ background: "#ddd", flex: 1, minHeight: 0, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, left: 12, position: "absolute", top: 12, zIndex: 10 }}>
                <button onClick={remount} style={{ background: "#333", borderRadius: 6, color: "white", padding: 10 }} type="button">
                    Remount ({INITIAL_COUNT} last only)
                </button>
                <button
                    onClick={() => setShowAll(true)}
                    style={{ background: "#1a73e8", borderRadius: 6, color: "white", padding: 10 }}
                    type="button"
                >
                    Load older (prepend {DATA.length - INITIAL_COUNT})
                </button>
            </div>

            <div
                style={{
                    background: "white",
                    border: "1px solid red",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    height: LIST_RECT.height,
                    left: LIST_RECT.x,
                    position: "absolute",
                    top: LIST_RECT.y,
                    width: LIST_RECT.width,
                }}
            >
                <LegendList<Item>
                    className="min-h-0 flex-1"
                    data={visibleData}
                    initialScrollIndex={{ index: INITIAL_LAST_INDEX, viewPosition: 0 }}
                    itemsAreEqual={(itA, itB) => itA.id === itB.id}
                    key={mountKey}
                    keyExtractor={(item) => item.id}
                    maintainScrollAtEndThreshold={1}
                    maintainVisibleContentPosition
                    recycleItems
                    ref={listRef}
                    renderItem={({ item }) => (
                        <div
                            style={{
                                alignItems: "center",
                                background: item.height > 200 ? "#e8f0fe" : "#fff",
                                borderBottom: "1px solid #ccc",
                                boxSizing: "border-box",
                                display: "flex",
                                height: item.height,
                                paddingLeft: 12,
                                paddingRight: 12,
                            }}
                        >
                            <span>{`#${item.index} · ${Math.round(item.height)}px`}</span>
                        </div>
                    )}
                />
            </div>
        </div>
    );
}
