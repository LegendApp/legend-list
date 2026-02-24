import React from "react";

// For now, let's create a simple test that tries to import LegendList
// and see what breaks
const SimpleLegendListTest: React.FC = () => {
    const data = React.useMemo(
        () =>
            Array.from({ length: 50 }, (_, index) => ({
                description: `Description for item ${index + 1}`,
                id: `item-${index}`,
                title: `Item ${index + 1}`,
            })),
        [],
    );

    const renderItem = ({ item }: { item: (typeof data)[0] }) => (
        <div
            style={{
                backgroundColor: "#f0f0f0",
                borderRadius: 8,
                marginBottom: 8,
                minHeight: 60,
                padding: 16,
            }}
        >
            <div style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>{item.title}</div>
            <div style={{ color: "#666", fontSize: 14 }}>{item.description}</div>
        </div>
    );

    return (
        <div
            style={{
                border: "1px solid #ccc",
                display: "flex",
                flexDirection: "column",
                height: 400,
                width: "100%",
            }}
        >
            <div
                style={{
                    backgroundColor: "#e0e0e0",
                    borderBottom: "1px solid #ccc",
                    flexShrink: 0,
                    padding: 16,
                }}
            >
                <div style={{ fontSize: 18, fontWeight: "bold" }}>Simple Legend List Web Test</div>
            </div>

            <div
                style={{
                    flex: 1,
                    height: "calc(100% - 60px)", // Account for header height
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                }}
            >
                {data.map((item) => (
                    <div key={item.id}>{renderItem({ item })}</div>
                ))}
            </div>
        </div>
    );
};

export default SimpleLegendListTest;
