import { LegendList } from "@legendapp/list/react";
import { buildMediaRails, type MediaPoster, type MediaRail } from "@examples/media";
import { CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const mediaRails = buildMediaRails();

export function MediaRailsExample() {
    return (
        <Shell title="Media Rails">
            <LegendList
                data={mediaRails}
                estimatedItemSize={240}
                keyExtractor={(item) => item.id}
                renderItem={({ item }: { item: MediaRail }) => (
                    <div className="mb-[18px] min-w-0">
                        <h2 className="mb-[10px] mt-0">{item.title}</h2>
                        <LegendList
                            contentContainerStyle={{ paddingBottom: 8, paddingRight: 16 }}
                            data={item.posters}
                            estimatedItemSize={152}
                            horizontal
                            keyExtractor={(poster) => poster.id}
                            renderItem={({ item: poster }: { item: MediaPoster }) => (
                                <div
                                    className={`${CARD_CLASS} relative mr-3 h-[170px] min-w-[132px] w-[132px] overflow-hidden p-0 text-white`}
                                    style={{
                                        ...cardStyle(poster.color),
                                    }}
                                >
                                    <img
                                        alt={poster.title}
                                        className="absolute inset-0 h-full w-full object-cover"
                                        src={poster.imageUrl}
                                    />
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            background:
                                                "linear-gradient(180deg, rgba(9, 9, 11, 0) 0%, rgba(9, 9, 11, 0.04) 50%, rgba(9, 9, 11, 0.88) 100%)",
                                        }}
                                    />
                                    <div className="relative flex min-h-full flex-1 flex-col justify-end p-3">
                                        <div className="mb-1 text-[10px] font-semibold uppercase leading-3 tracking-[0.2px] opacity-[0.88]">
                                            {poster.subtitle}
                                        </div>
                                        <div className="text-sm font-semibold leading-4">{poster.title}</div>
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
