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
                    background: "#222324",
                    color: "#fff",
                }}
            >
                <div style={{ margin: "0 auto", padding: "32px 32px", maxWidth: 1120, position: "relative", zIndex: 1 }}>
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
                            lineHeight: 1,
                            margin: 0,
                        }}
                    >
                        {heading}
                    </h1>
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
                    padding: "52px 32px 96px",
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
                                    <div
                                        style={{
                                            color: "#888",
                                            fontSize: 13,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        {entry.description}
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
