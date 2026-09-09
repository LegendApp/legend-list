import React from "react";

import { LegendList, type LegendListItemSeparatorProps } from "@legendapp/list/react";
import {
    buildTimelineEntries,
    cycleTimelineEntryKind,
    TIMELINE_KIND_COLORS,
    TIMELINE_KIND_LABELS,
    TIMELINE_KINDS,
    type TimelineEntry,
} from "@examples/timeline";
import { listViewportStyle, Shell } from "./shared";

// Entries of the same kind are joined by a hairline in their shared color, while a change of kind
// gets a thicker bar split between the color of the item above and the item below it.
function TimelineSeparator({ leadingItem, trailingItem }: LegendListItemSeparatorProps<TimelineEntry>) {
    const leadingColor = TIMELINE_KIND_COLORS[leadingItem.kind];

    if (!trailingItem || trailingItem.kind === leadingItem.kind) {
        return <div style={{ background: leadingColor, height: 1, opacity: 0.35 }} />;
    }

    return (
        <div className="flex" style={{ height: 6 }}>
            <div className="flex-1" style={{ background: leadingColor }} />
            <div className="flex-1" style={{ background: TIMELINE_KIND_COLORS[trailingItem.kind] }} />
        </div>
    );
}

export function ItemSeparatorsExample() {
    const [entries, setEntries] = React.useState(() => buildTimelineEntries());

    const cycleKind = React.useCallback((id: string) => {
        setEntries((current) => cycleTimelineEntryKind(current, id));
    }, []);

    return (
        <Shell title="Item Separators">
            <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-2 flex flex-wrap gap-3">
                    {TIMELINE_KINDS.map((kind) => (
                        <div className="flex items-center gap-1.5" key={kind}>
                            <span className="size-3 rounded-[3px]" style={{ background: TIMELINE_KIND_COLORS[kind] }} />
                            <span className="text-xs text-slate-600">{TIMELINE_KIND_LABELS[kind]}</span>
                        </div>
                    ))}
                </div>
                <p className="mb-3 mt-0 text-[13px] text-slate-500">
                    Click an entry to change its kind. The separator above it recolors too, because separators re-render
                    when their trailing item changes.
                </p>
                <LegendList
                    data={entries}
                    estimatedItemSize={68}
                    ItemSeparatorComponent={TimelineSeparator}
                    keyExtractor={(item) => item.id}
                    recycleItems
                    renderItem={({ item }: { item: TimelineEntry }) => (
                        <button
                            className="flex w-full items-center gap-3 bg-white px-4 py-3.5 text-left"
                            onClick={() => cycleKind(item.id)}
                            type="button"
                        >
                            <span
                                className="size-3 rounded-full"
                                style={{ background: TIMELINE_KIND_COLORS[item.kind] }}
                            />
                            <span>
                                <span className="block font-extrabold">{item.title}</span>
                                <span className="block text-slate-500">
                                    {TIMELINE_KIND_LABELS[item.kind]} · {item.meta}
                                </span>
                            </span>
                            <span className="ml-auto text-[11px] text-slate-400">Change kind</span>
                        </button>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}
