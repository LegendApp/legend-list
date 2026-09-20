import { useRef, useState } from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";

type Message = { height: number; id: string };
const data: Message[] = Array.from({ length: 51 }, (_, index) => ({
    height: index === 50 ? 300 : 96,
    id: String(index),
}));
const keyExtractor = (item: Message) => item.id;
const follow = { animated: false, on: { dataChange: true, footerLayout: true, itemLayout: true, layout: true } };
const contentStyle = { paddingTop: 16 };
function Row({ item }: LegendListRenderItemProps<Message>) {
    return (
        <div
            style={{
                background: item.id === "50" ? "linear-gradient(to top, #00ff00 16px, #ddeeff 16px)" : "#ddeeff",
                borderTop: "1px solid #778899",
                boxSizing: "border-box",
                height: item.height,
            }}
        >
            Message {item.id}
        </div>
    );
}

// The green end marker must stay at y=608 in the standalone fixture's captured
// compositor frames, including the first paint after the pinned bar appears.
export default function EndResizeExample() {
    const ref = useRef<LegendListRef>(null);
    const [pinned, setPinned] = useState(false);
    const [ready, setReady] = useState(false);
    const footer = Number(new URLSearchParams(window.location.search).get("footer") ?? 16);
    return (
        <div data-ready={ready}>
            <div style={{ display: "flex", flexDirection: "column", height: 609, width: 800 }}>
                {pinned && <div style={{ background: "#ffaaaa", flexShrink: 0, height: 56 }}>Pinned messages</div>}
                <LegendList
                    alignItemsAtEnd
                    contentContainerStyle={contentStyle}
                    data={data}
                    drawDistance={1000}
                    estimatedItemSize={61}
                    id="end-resize-list"
                    initialScrollAtEnd
                    keyExtractor={keyExtractor}
                    ListFooterComponent={<div style={{ background: "#00ff00", height: footer }} />}
                    maintainScrollAtEnd={follow}
                    maintainScrollAtEndThreshold={0.1}
                    maintainVisibleContentPosition
                    onLoad={() => setReady(true)}
                    recycleItems={false}
                    ref={ref}
                    renderItem={Row}
                    style={{ flex: 1, minHeight: 0 }}
                />
            </div>
            <button id="toggle-pin" onClick={() => setPinned((value) => !value)} type="button">
                Toggle pinned bar
            </button>
            <button
                id="history"
                onClick={() => ref.current?.scrollToOffset({ animated: false, offset: 200 })}
                type="button"
            >
                Read history
            </button>
            <button id="end" onClick={() => ref.current?.scrollToEnd({ animated: false })} type="button">
                End
            </button>
        </div>
    );
}
