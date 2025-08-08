import React, { useCallback, useMemo, useRef, useState } from "react";

import { LazyLegendList } from "@/components/LazyLegendList";
import { LegendList } from "@/components/LegendList";
import { Text } from "@/platform/Text";
import { View } from "@/platform/View";
import VirtualListComparison from "./VirtualListComparison";

type ExampleItem = {
    key: string;
    title: string;
    component: React.ReactNode;
};

type Country = { id: string; name: string; flag: string };
type SimpleItem = { id: string };
type CountryRowHeader = { id: string; type: "header"; title: string };
type CountryRowItem = { id: string; type: "row"; name: string; flag: string };
type CountryRow = CountryRowHeader | CountryRowItem;

// Utilities
const generateItems = (count: number, startIndex = 0) =>
    Array.from({ length: count }, (_, i) => ({ id: String(startIndex + i) }));

// Countries data (lazy import to avoid bundling if not viewed)
const useCountries = () => {
    const [countriesData, setCountriesData] = useState<Country[]>([]);

    const load = useCallback(async () => {
        try {
            const mod = await import("countries-list");
            const countries = mod.countries as Record<string, { name: string }>;
            const getEmojiFlag = (mod as any).getEmojiFlag as (code: string) => string;
            const data: Country[] = Object.entries(countries)
                .map(([code, country]) => ({ flag: getEmojiFlag(code), id: code, name: country.name }))
                .sort((a, b) => a.name.localeCompare(b.name));
            setCountriesData(data);
        } catch (_e) {
            // Fallback demo data if dependency not installed
            const fallback: Country[] = [
                { flag: "🇺🇸", id: "US", name: "United States" },
                { flag: "🇬🇧", id: "GB", name: "United Kingdom" },
                { flag: "🇯🇵", id: "JP", name: "Japan" },
                { flag: "🇫🇷", id: "FR", name: "France" },
                { flag: "🇩🇪", id: "DE", name: "Germany" },
                { flag: "🇮🇳", id: "IN", name: "India" },
            ].sort((a, b) => a.name.localeCompare(b.name));
            setCountriesData(fallback);
        }
    }, []);

    return { countriesData, load };
};

// Example 1: Countries list with search
const CountriesExample = () => {
    const { countriesData, load } = useCountries();
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | undefined>();

    React.useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return countriesData.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
    }, [countriesData, query]);

    return (
        <View style={{ display: "flex", gap: 8 }}>
            <div>
                <input
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search country or code..."
                    style={{
                        background: "#f5f5f5",
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        fontSize: 14,
                        height: 36,
                        padding: "0 10px",
                        width: 300,
                    }}
                    value={query}
                />
            </div>
            <LegendList<Country>
                data={filtered}
                estimatedItemSize={60}
                extraData={selectedId}
                keyExtractor={(item) => item?.id}
                recycleItems
                renderItem={({ item }: { item: Country }) => (
                    <button
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            alignItems: "center",
                            background: selectedId === item.id ? "#eef6ff" : "#fff",
                            border: "1px solid #eee",
                            borderRadius: 8,
                            display: "flex",
                            gap: 12,
                            padding: "8px 12px",
                            textAlign: "left",
                            width: "100%",
                        }}
                        type="button"
                    >
                        <View
                            style={{
                                alignItems: "center",
                                backgroundColor: "#f8f9fa",
                                borderRadius: 20,
                                height: 40,
                                justifyContent: "center",
                                width: 40,
                            }}
                        >
                            <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                        </View>
                        <Text style={{ fontWeight: 500 }}>{item.name} </Text>
                        <Text style={{ color: "#666", fontSize: 12 }}>({item.id})</Text>
                    </button>
                )}
                style={{ borderRadius: 8 }}
            />
        </View>
    );
};

// Example 2: Lazy list
const LazyListExample = () => {
    const data = useMemo(() => generateItems(120), []);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    return (
        <View style={{ border: "1px solid #eee", borderRadius: 8 }}>
            <LazyLegendList maintainVisibleContentPosition recycleItems>
                <View style={{ padding: 12 }}>
                    <Text style={{ fontWeight: "bold" }}>Countries lazy scrollview (demo data)</Text>
                </View>
                {data.map((item, index) => (
                    <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{
                            alignItems: "center",
                            background: selectedId === item.id ? "#eef6ff" : "#fff",
                            borderBottom: "1px solid #f0f0f0",
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            textAlign: "left",
                            width: "100%",
                        }}
                        type="button"
                    >
                        <Text>Item {index}</Text>
                        <Text style={{ color: "#666", fontSize: 12 }}>id: {item.id}</Text>
                    </button>
                ))}
            </LazyLegendList>
        </View>
    );
};

// Example 3: MVCP test (mutable heights)
const MVCPTestExample = () => {
    const [heights, setHeights] = useState<Record<number, number>>({});
    const data = useMemo(() => generateItems(30), []);

    const getHeight = (index: number) => heights[index] ?? 300;

    return (
        <View style={{ background: "#456", position: "relative" }}>
            <LegendList
                data={data}
                estimatedItemSize={300}
                initialScrollIndex={10}
                keyExtractor={(it) => it?.id}
                recycleItems
                renderItem={({ index }: { index: number }) => {
                    const h = getHeight(index);
                    const bg = ["#f87171", "#34d399", "#facc15", "#a78bfa", "#60a5fa", "#fb923c", "#d1d5db"][index % 7];
                    return (
                        <button
                            onClick={() =>
                                setHeights((prev) => ({ ...prev, [index - 1]: (prev[index - 1] ?? 300) + 100 }))
                            }
                            style={{
                                alignItems: "center",
                                background: bg,
                                color: "white",
                                display: "flex",
                                height: h,
                                justifyContent: "center",
                                position: "relative",
                                width: "100%",
                            }}
                            type="button"
                        >
                            <div style={{ fontSize: 12, left: 10, position: "absolute", top: 8 }}>
                                item #{index} height: {h}
                            </div>
                            <Text style={{ color: "white" }}>Change</Text>
                        </button>
                    );
                }}
                style={{ inset: 0, position: "absolute" }}
            />
        </View>
    );
};

// Example 4: Columns
const ColumnsExample = () => {
    const [data, setData] = useState(generateItems(8));
    React.useEffect(() => {
        const t = setTimeout(() => setData(generateItems(20)), 1000);
        return () => clearTimeout(t);
    }, []);
    return (
        <View style={{ background: "#fff" }}>
            <LegendList
                columnWrapperStyle={{ columnGap: 16, rowGap: 16 }}
                data={data}
                keyExtractor={(it) => it?.id}
                numColumns={3}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ aspectRatio: 1 }}>
                        <View style={{ backgroundColor: "red", borderRadius: 8, height: "100%", width: "100%" }} />
                        <Text>Item {item.id}</Text>
                    </View>
                )}
            />
        </View>
    );
};

// Example 5: Initial scroll index with mixed item types
const InitialScrollIndexExample = () => {
    type Row = { id: string; type: "item" | "separator" };
    const data = useMemo<Row[]>(
        () => Array.from({ length: 500 }, (_, i) => ({ id: String(i), type: i % 3 === 0 ? "separator" : "item" })),
        [],
    );
    return (
        <View style={{ background: "#456", position: "relative" }}>
            <LegendList<Row>
                data={data}
                drawDistance={1000}
                estimatedItemSize={200}
                getEstimatedItemSize={(i) => (data[i].type === "separator" ? 52 : 400)}
                initialScrollIndex={50}
                keyExtractor={(it) => it?.id}
                renderItem={({ item, index }: { item: Row; index: number }) =>
                    item.type === "separator" ? (
                        <View
                            style={{
                                alignItems: "center",
                                backgroundColor: "red",
                                height: 52,
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ color: "white" }}>Separator {item.id}</Text>
                        </View>
                    ) : (
                        <View
                            style={{
                                alignItems: "center",
                                background: index % 2 ? "#f0f0f0" : "#eaeaea",
                                height: 400,
                                justifyContent: "center",
                            }}
                        >
                            <Text>Item {item.id}</Text>
                        </View>
                    )
                }
                style={{ inset: 0, padding: 16, position: "absolute" }}
            />
        </View>
    );
};

// Example 6: Accurate scrollTo controls
const AccurateScrollToExample = () => {
    const ref = useRef<any>(null);
    const data = useMemo(() => generateItems(1000), []);
    return (
        <View style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 300 })} type="button">
                    Scroll to 300
                </button>
                <button onClick={() => ref.current?.scrollToOffset?.({ animated: true, offset: 20000 })} type="button">
                    Scroll to offset 20000
                </button>
            </div>
            <LegendList<SimpleItem>
                data={data}
                estimatedItemSize={100}
                keyExtractor={(it) => it?.id}
                ref={ref}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ background: "#fff", borderRadius: 8, padding: 12 }}>
                        <Text>Item {item.id}</Text>
                    </View>
                )}
                style={{ borderRadius: 8 }}
            />
        </View>
    );
};

// Example 7: Add to end
const AddToEndExample = () => {
    const [data, setData] = useState(() => generateItems(50));
    const addMore = () => setData((d) => [...d, ...generateItems(20, d.length)]);
    return (
        <View style={{ display: "flex", gap: 8 }}>
            <button onClick={addMore} type="button">
                Add 20 items
            </button>
            <LegendList<SimpleItem>
                data={data}
                estimatedItemSize={80}
                keyExtractor={(it) => it?.id}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 12 }}>
                        <Text>Item {item.id}</Text>
                    </View>
                )}
            />
        </View>
    );
};

// Example 8: Bidirectional infinite list
const BidirectionalInfiniteListExample = () => {
    const [start, setStart] = useState(-50);
    const [end, setEnd] = useState(50);
    const data = useMemo(() => generateItems(end - start + 1, start), [start, end]);
    return (
        <LegendList
            data={data}
            estimatedItemSize={60}
            keyExtractor={(it) => it?.id}
            onEndReached={() => setEnd((e) => e + 50)}
            onEndReachedThreshold={0.2}
            onStartReached={() => setStart((s) => s - 50)}
            onStartReachedThreshold={0.2}
            renderItem={({ item }: { item: SimpleItem }) => (
                <View style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 12 }}>
                    <Text>Item {item.id}</Text>
                </View>
            )}
        />
    );
};

// Example 9: Countries with headers (sticky)
const CountriesWithHeadersStickyExample = () => {
    const { countriesData, load } = useCountries();
    React.useEffect(() => void load(), [load]);
    const { data, sticky } = useMemo(() => {
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
                    <View style={{ background: "#fafafa", borderBottom: "1px solid #eee", padding: 8 }}>
                        <Text style={{ fontWeight: "bold" }}>{item.title}</Text>
                    </View>
                ) : (
                    <View style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 10 }}>
                        <Text>
                            {item.flag} {item.name}
                        </Text>
                    </View>
                )
            }
            stickyIndices={sticky}
            style={{ borderRadius: 8 }}
        />
    );
};

// Example 10: Mutable cells (simple)
const MutableCellsExample = () => {
    const [data] = useState(() => generateItems(60));
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    return (
        <LegendList<SimpleItem>
            data={data}
            estimatedItemSize={100}
            keyExtractor={(it) => it?.id}
            renderItem={({ item }: { item: SimpleItem }) => {
                const isOpen = !!expanded[item.id];
                return (
                    <div style={{ borderBottom: "1px solid #f0f0f0", padding: 12 }}>
                        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
                            <Text>Item {item.id}</Text>
                            <button
                                onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}
                                type="button"
                            >
                                {isOpen ? "Collapse" : "Expand"}
                            </button>
                        </div>
                        {isOpen && (
                            <div style={{ background: "#fafafa", borderRadius: 6, marginTop: 8, padding: 8 }}>
                                <Text>
                                    Extra content for item {item.id}. Click the button to toggle height and test
                                    measurement updates.
                                </Text>
                            </div>
                        )}
                    </div>
                );
            }}
        />
    );
};

// Example 11: Extra data
const ExtraDataExample = () => {
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const data = useMemo(() => generateItems(100), []);
    return (
        <LegendList<SimpleItem>
            data={data}
            estimatedItemSize={60}
            extraData={selectedId}
            keyExtractor={(it) => it?.id}
            renderItem={({ item }: { item: SimpleItem }) => (
                <button
                    onClick={() => setSelectedId(item.id)}
                    style={{
                        background: item.id === selectedId ? "#eef6ff" : undefined,
                        borderBottom: "1px solid #f0f0f0",
                        padding: 12,
                        textAlign: "left",
                        width: "100%",
                    }}
                    type="button"
                >
                    <Text>Item {item.id}</Text>
                </button>
            )}
        />
    );
};

// Example 12: Accurate scrollTo huge
const AccurateScrollToHugeExample = () => {
    const ref = useRef<any>(null);
    const data = useMemo(() => generateItems(20000), []);
    return (
        <View style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => ref.current?.scrollToIndex?.({ animated: true, index: 12345 })} type="button">
                    Scroll to 12,345
                </button>
                <button onClick={() => ref.current?.scrollToEnd?.({ animated: true })} type="button">
                    Scroll to end
                </button>
            </div>
            <LegendList
                data={data}
                estimatedItemSize={60}
                keyExtractor={(it) => it?.id}
                recycleItems
                ref={ref}
                renderItem={({ item }: { item: SimpleItem }) => (
                    <View style={{ background: "#fff", borderBottom: "1px solid #f0f0f0", padding: 8 }}>
                        <Text>Item {item.id}</Text>
                    </View>
                )}
            />
        </View>
    );
};

const EXAMPLES: ExampleItem[] = [
    {
        component: <BidirectionalInfiniteListExample />,
        key: "bidirectional-infinite-list",
        title: "Bidirectional Infinite List",
    },
    { component: <CountriesExample />, key: "countries", title: "Countries List" },
    {
        component: <CountriesWithHeadersStickyExample />,
        key: "countries-with-headers-sticky",
        title: "Countries with headers sticky",
    },
    { component: <LazyListExample />, key: "lazy-list", title: "Lazy List" },
    { component: <MVCPTestExample />, key: "mvcp-test", title: "MVCP test" },
    { component: <ColumnsExample />, key: "columns", title: "Columns" },
    { component: <InitialScrollIndexExample />, key: "initial-scroll-index", title: "Initial scroll index" },
    { component: <AccurateScrollToExample />, key: "accurate-scrollto", title: "Accurate scrollTo" },
    { component: <AddToEndExample />, key: "add-to-end", title: "Add to the end" },
    { component: <MutableCellsExample />, key: "mutable-cells", title: "Mutable cells" },
    { component: <ExtraDataExample />, key: "extra-data", title: "Extra data" },
    { component: <AccurateScrollToHugeExample />, key: "accurate-scrollto-huge", title: "Accurate scrollTo huge" },
    { component: <VirtualListComparison />, key: "virtual-list-comparison", title: "Virtual List Comparison" },
];

export default function AllExamples() {
    const [selectedKey, setSelectedKey] = useState<string>(EXAMPLES[0].key);
    const selected = EXAMPLES.find((e) => e.key === selectedKey)!;
    return (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "260px 1fr" }}>
            <div style={{ borderRight: "1px solid #eee", paddingRight: 12 }}>
                <h2 style={{ marginTop: 0 }}>Legend List Web Examples</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {EXAMPLES.map((ex) => (
                        <button
                            key={ex.key}
                            onClick={() => setSelectedKey(ex.key)}
                            style={{
                                background: ex.key === selectedKey ? "#eef6ff" : "#fff",
                                border: ex.key === selectedKey ? "1px solid #8ab4f8" : "1px solid #ddd",
                                borderRadius: 6,
                                cursor: "pointer",
                                padding: "8px 10px",
                                textAlign: "left",
                            }}
                            type="button"
                        >
                            {ex.title}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ margin: 0 }}>{selected.title}</h3>
                <div style={{ height: 520, overflow: "hidden" }}>{selected.component}</div>
            </div>
        </div>
    );
}
