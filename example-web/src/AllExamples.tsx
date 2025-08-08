import { useState } from "react";

import AccurateScrollToExample from "./examples/AccurateScrollToExample";
import AccurateScrollToHugeExample from "./examples/AccurateScrollToHugeExample";
import AddToEndExample from "./examples/AddToEndExample";
import BidirectionalInfiniteListExample from "./examples/BidirectionalInfiniteListExample";
import ColumnsExample from "./examples/ColumnsExample";
import CountriesExample from "./examples/CountriesExample";
import CountriesWithHeadersStickyExample from "./examples/CountriesWithHeadersStickyExample";
import ExtraDataExample from "./examples/ExtraDataExample";
import InitialScrollIndexExample from "./examples/InitialScrollIndexExample";
import LazyListExample from "./examples/LazyListExample";
import MutableCellsExample from "./examples/MutableCellsExample";
import MVCPTestExample from "./examples/MVCPTestExample";
import VirtualListComparison from "./VirtualListComparison";

type ExampleItem = {
    key: string;
    title: string;
    component: React.ReactNode;
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
                <div style={{ display: "flex", flexDirection: "column", height: 520, overflow: "hidden" }}>
                    {selected.component}
                </div>
            </div>
        </div>
    );
}
