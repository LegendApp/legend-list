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
                className="hero"
                style={{
                    background: "#0c0c0c",
                    color: "#fff",
                    padding: "80px 40px 72px",
                }}
            >
                <div style={{ margin: "0 auto", maxWidth: 1120, position: "relative", zIndex: 1 }}>
                    <p
                        style={{
                            color: "var(--accent)",
                            fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                            fontSize: 12,
                            fontWeight: 500,
                            letterSpacing: 2,
                            margin: "0 0 20px",
                            opacity: 0.7,
                            textTransform: "uppercase",
                        }}
                    >
                        @legendapp/list
                    </p>
                    <h1
                        style={{
                            fontSize: 52,
                            fontWeight: 700,
                            letterSpacing: -2,
                            lineHeight: 1.05,
                            margin: 0,
                        }}
                    >
                        {heading}
                    </h1>
                    <p
                        style={{
                            color: "rgba(255,255,255,0.42)",
                            fontSize: 17,
                            fontWeight: 400,
                            lineHeight: 1.65,
                            margin: "18px 0 0",
                            maxWidth: 520,
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
                    gap: 56,
                    margin: "0 auto",
                    maxWidth: 1120,
                    padding: "52px 40px 96px",
                    width: "100%",
                }}
            >
                {sections.map((section) => (
                    <section key={section.title} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
                            <div
                                style={{
                                    background: "var(--accent)",
                                    borderRadius: 1,
                                    height: 1.5,
                                    opacity: 0.5,
                                    width: 16,
                                }}
                            />
                            <span
                                style={{
                                    color: "#aaa",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    letterSpacing: 1.5,
                                    textTransform: "uppercase",
                                }}
                            >
                                {section.title}
                            </span>
                        </div>
                        <div
                            style={{
                                display: "grid",
                                gap: 12,
                                gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
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
                                        border: "1px solid #ebebeb",
                                        borderRadius: 12,
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        padding: "18px 20px 16px",
                                        textAlign: "left",
                                    }}
                                    type="button"
                                >
                                    <div
                                        style={{
                                            alignItems: "center",
                                            display: "flex",
                                            gap: 8,
                                            justifyContent: "space-between",
                                            width: "100%",
                                        }}
                                    >
                                        <span style={{ color: "#111", fontSize: 15, fontWeight: 600 }}>
                                            {entry.title}
                                        </span>
                                        <span
                                            className="card-arrow"
                                            style={{
                                                color: "var(--accent)",
                                                flexShrink: 0,
                                                fontSize: 15,
                                                fontWeight: 300,
                                            }}
                                        >
                                            &rarr;
                                        </span>
                                    </div>
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
                                                    border: "1px solid #e8e8e8",
                                                    borderRadius: 5,
                                                    color: "#aaa",
                                                    fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                                                    fontSize: 10,
                                                    fontWeight: 500,
                                                    padding: "2px 7px",
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
