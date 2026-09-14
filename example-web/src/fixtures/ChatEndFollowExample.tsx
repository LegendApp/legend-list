import { useRef, useState } from "react";

import { LegendList, type LegendListRef, type LegendListRenderItemProps } from "@legendapp/list/react";

type Message = { id: string; typing?: boolean };
const keyExtractor = (item: Message) => item.id;
const createMessages = (count: number, chat = 0): Message[] =>
    Array.from({ length: count }, (_, index) => ({ id: `${chat}-${index}` }));

function Row({ item }: LegendListRenderItemProps<Message>) {
    return (
        <div
            className="border-b border-slate-200 p-3"
            data-message={item.id}
            role={item.typing ? "status" : undefined}
            style={{ height: item.typing ? 48 : 97 }}
        >
            {item.typing ? "Typing..." : `Message ${item.id}`}
        </div>
    );
}

// Deterministic controls for growth during scrollToEnd, no-op animated requests,
// footer removal, and preserving a reader's explicit history target.
export default function ChatEndFollowExample() {
    const params = new URLSearchParams(window.location.search);
    const count = Number(params.get("count") ?? 25);
    const footer = params.get("footer") === "true";
    const ref = useRef<LegendListRef>(null);
    const nextResponseId = useRef(0);
    const [messages, setMessages] = useState(() => createMessages(count));
    const [typing, setTyping] = useState(false);
    const [chat, setChat] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [completed, setCompleted] = useState(0);
    const scrollToEnd = () => {
        void ref.current?.scrollToEnd({ animated: true }).then(() => setCompleted((value) => value + 1));
    };
    const addTyping = () => {
        if (footer) setTyping(true);
        else {
            setMessages((items) =>
                items.some((item) => item.typing) ? items : [...items, { id: `${chat}-typing`, typing: true }],
            );
        }
    };
    const respond = () => {
        const id = `${chat}-response-${nextResponseId.current++}`;
        setTyping(false);
        setMessages((items) => [...items.filter((item) => !item.typing), { id }]);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
                <button onClick={scrollToEnd} type="button">
                    End
                </button>
                <button onClick={() => ref.current?.scrollToOffset({ animated: false, offset: 200 })} type="button">
                    History
                </button>
                <button onClick={() => ref.current?.scrollToIndex({ animated: true, index: 2 })} type="button">
                    Animated history
                </button>
                <button onClick={addTyping} type="button">
                    Typing
                </button>
                <button onClick={respond} type="button">
                    Respond
                </button>
                <button onClick={() => setExpanded((value) => !value)} type="button">
                    Resize composer
                </button>
                <button
                    onClick={() => {
                        const next = chat + 1;
                        setChat(next);
                        setTyping(false);
                        setMessages(createMessages(next % 2 ? 4 : 25, next));
                    }}
                    type="button"
                >
                    Switch chat
                </button>
            </div>
            <output data-completed={completed}>Completed end requests: {completed}</output>
            <div className="flex flex-col overflow-hidden border border-slate-300" style={{ height: 480, width: 440 }}>
                <LegendList
                    className="min-h-0 flex-1"
                    data={messages}
                    dataKey={chat}
                    estimatedItemSize={97}
                    initialScrollAtEnd
                    keyExtractor={keyExtractor}
                    ListFooterComponent={
                        footer ? (
                            <div role={typing ? "status" : undefined} style={{ height: typing ? 64 : 16 }}>
                                {typing ? "Typing..." : null}
                            </div>
                        ) : undefined
                    }
                    maintainScrollAtEnd={params.get("maintain") !== "false"}
                    maintainVisibleContentPosition
                    recycleItems
                    ref={ref}
                    renderItem={Row}
                />
                <div className="shrink-0 bg-slate-100 p-3" data-composer style={{ height: expanded ? 160 : 64 }}>
                    Composer
                </div>
            </div>
        </div>
    );
}
