import { LegendList } from "@legendapp/list/react";
import { buildMediaRails, type MediaPoster, type MediaRail } from "@examples/media";
import { cardStyle, listViewportStyle, Shell } from "./shared";

const mediaRails = buildMediaRails();

export function MediaRailsExample() {
    return (
        <Shell title="Media Rails">
            <LegendList
                data={mediaRails}
                estimatedItemSize={240}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: MediaRail }) => (
                    <div style={{ marginBottom: 18, minWidth: 0 }}>
                        <h2 style={{ margin: "0 0 10px" }}>{item.title}</h2>
                        <LegendList
                            contentContainerStyle={{ paddingBottom: 8, paddingRight: 16 }}
                            data={item.posters}
                            estimatedItemSize={152}
                            horizontal
                            keyExtractor={(poster) => poster.id}
                            renderItem={({ item: poster }: { item: MediaPoster }) => (
                                <div
                                    style={{
                                        ...cardStyle(poster.color),
                                        color: "#fff",
                                        height: 170,
                                        marginRight: 12,
                                        minWidth: 132,
                                        overflow: "hidden",
                                        padding: 0,
                                        position: "relative",
                                        width: 132,
                                    }}
                                >
                                    <img
                                        alt={poster.title}
                                        src={poster.imageUrl}
                                        style={{
                                            height: "100%",
                                            inset: 0,
                                            objectFit: "cover",
                                            position: "absolute",
                                            width: "100%",
                                        }}
                                    />
                                    <div
                                        style={{
                                            background:
                                                "linear-gradient(180deg, rgba(9, 9, 11, 0) 0%, rgba(9, 9, 11, 0.04) 50%, rgba(9, 9, 11, 0.88) 100%)",
                                            inset: 0,
                                            position: "absolute",
                                        }}
                                    />
                                    <div
                                        style={{
                                            display: "flex",
                                            flex: 1,
                                            flexDirection: "column",
                                            justifyContent: "flex-end",
                                            minHeight: "100%",
                                            padding: 12,
                                            position: "relative",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 600,
                                                letterSpacing: 0.2,
                                                lineHeight: "12px",
                                                marginBottom: 4,
                                                opacity: 0.88,
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {poster.subtitle}
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: "16px" }}>
                                            {poster.title}
                                        </div>
                                    </div>
                                </div>
                            )}
                            style={{ minHeight: 190, minWidth: 0 }}
                        />
                    </div>
                )}
                style={listViewportStyle}
            />
        </Shell>
    );
}
