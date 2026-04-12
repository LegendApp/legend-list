import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildVideoFeed, type VideoClip } from "@examples/media";
import { cardStyle, listViewportStyle, Shell } from "./shared";

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
            <div ref={viewportRef} style={{ display: "flex", flex: 1, minHeight: 0 }}>
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
                                style={{
                                    boxSizing: "border-box",
                                    height: viewportHeight,
                                    paddingBottom: 12,
                                }}
                            >
                                <button
                                    onClick={() => setSelectedId(item.id)}
                                    onKeyDown={(event) => handleCardKeyDown(event, item.id)}
                                    style={{
                                        ...cardStyle(item.color),
                                        border: 0,
                                        color: "#fff",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        justifyContent: "flex-end",
                                        marginBottom: 0,
                                        textAlign: "left",
                                        width: "100%",
                                    }}
                                    type="button"
                                >
                                    <div style={{ opacity: 0.8 }}>{item.creator}</div>
                                    <div style={{ fontSize: 26, fontWeight: 800 }}>{item.title}</div>
                                    <div style={{ marginTop: 8, opacity: 0.85 }}>
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
