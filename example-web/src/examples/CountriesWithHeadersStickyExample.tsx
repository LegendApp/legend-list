import React from "react";

import { LegendList } from "@/components/LegendList";
import { useCountries } from "./utils";

type CountryRowHeader = { id: string; type: "header"; title: string };
type CountryRowItem = { id: string; type: "row"; name: string; flag: string };
type CountryRow = CountryRowHeader | CountryRowItem;

export default function CountriesWithHeadersStickyExample() {
    const { countriesData, load } = useCountries();
    React.useEffect(() => void load(), [load]);
    const { data, sticky } = React.useMemo(() => {
        const out: CountryRow[] = [];
        const sticky: number[] = [];
        let idx = 0;
        let lastLetter = "";
        for (const c of countriesData) {
            const letter = c.name?.[0] ?? "?";
            if (letter !== lastLetter) {
                out.push({ id: `h-${letter}`, title: letter, type: "header" });
                sticky.push(idx);
                idx++;
                lastLetter = letter;
            }
            out.push({ flag: c.flag, id: c.id, name: c.name, type: "row" });
            idx++;
        }
        return { data: out, sticky };
    }, [countriesData]);

    return (
        <LegendList<CountryRow>
            data={data}
            estimatedItemSize={60}
            keyExtractor={(it) => it?.id}
            renderItem={({ item }: { item: CountryRow }) =>
                item.type === "header" ? (
                    <div style={{ background: "#fafafa", borderBottom: "1px solid #eee", padding: 8 }}>
                        <div style={{ fontWeight: "bold" }}>{item.title}</div>
                    </div>
                ) : (
                    <div style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 10 }}>
                        <div>
                            {item.flag} {item.name}
                        </div>
                    </div>
                )
            }
            stickyIndices={sticky}
            style={{ borderRadius: 8, flex: 1, minHeight: 0 }}
        />
    );
}
