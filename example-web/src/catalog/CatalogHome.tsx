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
                gap: 32,
                margin: "0 auto",
                maxWidth: 1180,
                padding: "40px 24px 64px",
                width: "100%",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 760 }}>
                <h1 style={{ fontSize: 42, margin: 0 }}>{heading}</h1>
                <p style={{ color: "#52606D", fontSize: 18, lineHeight: 1.5, margin: 0 }}>{subheading}</p>
            </div>
            {sections.map((section) => (
                <section key={section.title} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 style={{ fontSize: 24, margin: 0 }}>{section.title}</h2>
                    <div
                        style={{
                            display: "grid",
                            gap: 16,
                            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        }}
                    >
                        {section.entries.map((entry) => (
                            <button
                                key={entry.slug}
                                onClick={() => onOpen(entry.slug)}
                                style={{
                                    alignItems: "flex-start",
                                    background: "#fff",
                                    border: "1px solid #E6EAF0",
                                    borderRadius: 20,
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 14,
                                    padding: 18,
                                    textAlign: "left",
                                }}
                                type="button"
                            >
                                <div style={{ fontSize: 20, fontWeight: 700 }}>{entry.title}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {entry.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            style={{
                                                background: "#EEF6FF",
                                                borderRadius: 999,
                                                color: "#275D96",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                padding: "6px 10px",
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
    );
}
