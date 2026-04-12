import React from "react";

import { LegendList } from "@legendapp/list/react";
import { buildDirectoryPeople, type DirectoryPerson } from "@examples/directory";
import { CARD_CLASS, cardStyle, listViewportStyle, Shell } from "./shared";

const directoryPeople = buildDirectoryPeople();

export function DirectoryExample() {
    const [query, setQuery] = React.useState("");
    const filtered = React.useMemo(() => {
        const q = query.toLowerCase();
        return directoryPeople.filter(
            (person) => person.name.toLowerCase().includes(q) || person.department.toLowerCase().includes(q),
        );
    }, [query]);

    return (
        <Shell title="Directory">
            <div className="flex min-h-0 flex-1 flex-col">
                <input
                    className="mb-3 rounded-2xl border border-slate-200 bg-white px-[14px] py-3"
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people or team..."
                    value={query}
                />
                <LegendList
                    data={filtered}
                    estimatedItemSize={72}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: { item: DirectoryPerson }) => (
                        <div className={`${CARD_CLASS} flex items-center gap-3`} style={cardStyle()}>
                            <div
                                className="flex size-[42px] items-center justify-center rounded-full text-white font-extrabold"
                                style={{
                                    background: item.accent,
                                }}
                            >
                                {item.initials}
                            </div>
                            <div>
                                <div className="font-extrabold">{item.name}</div>
                                <div className="text-slate-500">
                                    {item.title} · {item.department} · {item.city}
                                </div>
                            </div>
                        </div>
                    )}
                    style={listViewportStyle}
                />
            </div>
        </Shell>
    );
}
