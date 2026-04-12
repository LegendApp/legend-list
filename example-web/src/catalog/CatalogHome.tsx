import type { CatalogSection } from "./types";

export function CatalogHome({
    heading,
    onOpen,
    sections,
    subheading,
}: {
    heading: string;
    onOpen: (slug: string) => void;
    sections: CatalogSection[];
    subheading: string;
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
            }}
        >
            {/* Hero */}
            <div
                style={{
                    background: "#111",
                    color: "#fff",
                    padding: "64px 32px 56px",
                }}
            >
                <div style={{ margin: "0 auto", maxWidth: 1180 }}>
                    <p
                        style={{
                            color: "rgba(255,255,255,0.35)",
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: 1.5,
                            margin: "0 0 16px",
                            textTransform: "uppercase",
                        }}
                    >
                        @legendapp/list
                    </p>
                    <h1
                        style={{
                            fontSize: 44,
                            fontWeight: 700,
                            letterSpacing: -1.5,
                            lineHeight: 1.1,
                            margin: 0,
                        }}
                    >
                        {heading}
                    </h1>
                    <p
                        style={{
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 17,
                            lineHeight: 1.6,
                            margin: "14px 0 0",
                            maxWidth: 560,
                        }}
                    >
                        {subheading}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 48,
                    margin: "0 auto",
                    maxWidth: 1180,
                    padding: "44px 32px 80px",
                    width: "100%",
                }}
            >
                {sections.map((section) => (
                    <section key={section.title} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <h2
                            style={{
                                color: "#999",
                                fontSize: 12,
                                fontWeight: 600,
                                letterSpacing: 1.2,
                                margin: 0,
                                textTransform: "uppercase",
                            }}
                        >
                            {section.title}
                        </h2>
                        <div
                            style={{
                                display: "grid",
                                gap: 12,
                                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                            }}
                        >
                            {section.entries.map((entry) => (
                                <button
                                    className="catalog-card"
                                    key={entry.slug}
                                    onClick={() => onOpen(entry.slug)}
                                    style={{
                                        alignItems: "flex-start",
                                        background: "#fff",
                                        border: "1px solid #e8e8e8",
                                        borderRadius: 10,
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        padding: "16px 18px 14px",
                                        textAlign: "left",
                                    }}
                                    type="button"
                                >
                                    <div style={{ color: "#111", fontSize: 15, fontWeight: 600 }}>{entry.title}</div>
                                    {entry.description ? (
                                        <div
                                            style={{
                                                color: "#888",
                                                fontSize: 13,
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {entry.description}
                                        </div>
                                    ) : null}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                                        {entry.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                style={{
                                                    background: "#f5f5f5",
                                                    borderRadius: 5,
                                                    color: "#777",
                                                    fontSize: 11,
                                                    fontWeight: 500,
                                                    padding: "2px 8px",
                                                }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
