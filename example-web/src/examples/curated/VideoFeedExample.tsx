import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildVideoFeed, type VideoClip } from "@examples/media";
import { CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const initialVideoClips = buildVideoFeed();

export function VideoFeedExample() {
    const [clips, setClips] = React.useState(() => initialVideoClips);
    const [selectedId, setSelectedId] = React.useState(initialVideoClips[0]?.id);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const [viewportHeight, setViewportHeight] = React.useState(0);
    const handleCardKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>, id: string) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedId(id);
        }
    }, []);

    React.useEffect(() => {
        const element = viewportRef.current;
        if (!element) {
            return;
        }

        const update = () => {
            setViewportHeight(Math.max(0, Math.floor(element.getBoundingClientRect().height)));
        };

        update();

        const observer = new ResizeObserver(update);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return (
        <Shell title="Video Feed">
            <div className="flex min-h-0 flex-1" ref={viewportRef}>
                {viewportHeight > 0 ? (
                    <LegendList
                        data={clips}
                        estimatedItemSize={viewportHeight}
                        keyExtractor={(item) => item.id}
                        onEndReached={() => {
                            setClips((current) => buildVideoFeed(current.length + 12).slice(0, current.length + 12));
                        }}
                        renderItem={({ item }: { item: VideoClip }) => (
                            <div
                                className="box-border pb-3"
                                style={{
                                    height: viewportHeight,
                                }}
                            >
                                <button
                                    className={`${CARD_CLASS} mb-0 flex h-full w-full flex-col justify-end border-0 text-left text-white cursor-pointer`}
                                    onClick={() => setSelectedId(item.id)}
                                    onKeyDown={(event) => handleCardKeyDown(event, item.id)}
                                    style={{
                                        ...cardStyle(item.color),
                                    }}
                                    type="button"
                                >
                                    <div className="opacity-80">{item.creator}</div>
                                    <div className="text-[26px] font-extrabold">{item.title}</div>
                                    <div className="mt-2 opacity-[0.85]">
                                        {selectedId === item.id ? "Playing" : "Tap to focus"}
                                    </div>
                                </button>
                            </div>
                        )}
                        style={listViewportStyle}
                    />
                ) : null}
            </div>
        </Shell>
    );
}
