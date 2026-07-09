import React from "react";

import { LegendList } from "@legendapp/list/react";
import type { Country } from "./utils";
import { useCountries } from "./utils";

export default function CountriesExample() {
    const { countriesData, load } = useCountries();
    const [query, setQuery] = React.useState("");
    const [selectedId, setSelectedId] = React.useState<string | undefined>();

    React.useEffect(() => {
        load();
    }, [load]);

    const filtered = React.useMemo(() => {
        const q = query.toLowerCase();
        return countriesData.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }, [countriesData, query]);

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div>
                <input
                    className="h-9 w-[300px] rounded-lg border border-[#ddd] bg-[#f5f5f5] px-2.5 text-sm"
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search country or code..."
                    value={query}
                />
            </div>
            <LegendList<Country>
                className="min-h-0 flex-1 rounded-lg"
                data={filtered}
                estimatedItemSize={60}
                estimatedListSize={{ height: 520, width: 0 }}
                extraData={selectedId}
                keyExtractor={(item) => item?.id}
                recycleItems
                renderItem={({ item }: { item: Country }) => (
                    <button
                        className="flex w-full items-center gap-3 rounded-lg border border-[#eee] px-3 py-2 text-left"
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            background: selectedId === item.id ? "#eef6ff" : "#fff",
                        }}
                        type="button"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-[20px] bg-[#f8f9fa]">
                            <div className="text-[22px]">{item.flag}</div>
                        </div>
                        <div className="font-medium">{item.name} </div>
                        <div className="text-xs text-[#666]">({item.id})</div>
                    </button>
                )}
            />
        </div>
    );
}
