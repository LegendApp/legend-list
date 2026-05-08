import React from "react";

import { LegendList } from "@legendapp/list/react";
import { useCountries } from "./utils";

type CountryRowHeader = { id: string; type: "header"; title: string };
type CountryRowItem = { id: string; type: "row"; name: string; flag: string };
type CountryRow = CountryRowHeader | CountryRowItem;

export default function CountriesWithHeadersStickyExample() {
    const { countriesData, load } = useCountries();
    React.useEffect(() => void load(), [load]);
    const { data, sticky } = React.useMemo(() => {
        const out: CountryRow[] = [];
        const stickyIndices: number[] = [];
        let idx = 0;
        let lastLetter = "";
        for (const c of countriesData) {
            const letter = c.name?.[0] ?? "?";
            if (letter !== lastLetter) {
                out.push({ id: `h-${letter}`, title: letter, type: "header" });
                stickyIndices.push(idx);
                idx++;
                lastLetter = letter;
            }
            out.push({ flag: c.flag, id: c.id, name: c.name, type: "row" });
            idx++;
        }
        return { data: out, sticky: stickyIndices };
    }, [countriesData]);

    return (
        <LegendList<CountryRow>
            className="min-h-0 flex-1 rounded-lg"
            data={data}
            estimatedItemSize={60}
            keyExtractor={(it) => it?.id}
            recycleItems
            renderItem={({ item }: { item: CountryRow }) =>
                item.type === "header" ? (
                    <div className="border-b border-[#eee] bg-[#fafafa] p-2">
                        <div className="font-bold">{item.title}</div>
                    </div>
                ) : (
                    <div className="border-b border-[#f0f0f0] bg-white p-2.5">
                        <div>
                            {item.flag} {item.name}
                        </div>
                    </div>
                )
            }
            stickyHeaderIndices={sticky}
        />
    );
}
