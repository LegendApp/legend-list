import type { ReactNode } from "react";

import type { CatalogSection } from "./types";

export function SidebarShell({
    activeSlug,
    children,
    heading,
    onGoHome,
    onOpen,
    sections,
}: {
    activeSlug: string;
    children: ReactNode;
    heading: string;
    onGoHome: () => void;
    onOpen: (slug: string) => void;
    sections: CatalogSection[];
}) {
    return (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <aside
                style={{
                    background: "#0c0c0c",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    flexDirection: "column",
                    flexShrink: 0,
                    overflowY: "auto",
                    width: 232,
                }}
            >
                <button
                    className="sidebar-home-link"
                    onClick={onGoHome}
                    style={{
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: -0.2,
                        padding: "16px 18px",
                        textAlign: "left",
                    }}
                    type="button"
                >
                    {heading}
                </button>

                <nav style={{ display: "flex", flexDirection: "column", gap: 20, padding: "14px 10px 24px" }}>
                    {sections.map((section, sectionIdx) => (
                        <div key={section.title} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {sectionIdx > 0 && (
                                <div
                                    style={{
                                        background: "rgba(255,255,255,0.04)",
                                        height: 1,
                                        margin: "0 8px 8px",
                                    }}
                                />
                            )}
                            <div
                                style={{
                                    color: "rgba(255,255,255,0.22)",
                                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                                    fontSize: 10,
                                    fontWeight: 500,
                                    letterSpacing: 1.2,
                                    padding: "0 8px 5px",
                                    textTransform: "uppercase",
                                }}
                            >
                                {section.title}
                            </div>
                            {section.entries.map((entry) => {
                                const isActive = entry.slug === activeSlug;
                                return (
                                    <button
                                        className={`sidebar-item${isActive ? " sidebar-item-active" : ""}`}
                                        key={entry.slug}
                                        onClick={() => onOpen(entry.slug)}
                                        style={{
                                            background: isActive ? "rgba(232, 101, 58, 0.1)" : "transparent",
                                            border: "none",
                                            borderRadius: 6,
                                            color: isActive ? "var(--accent)" : "rgba(255,255,255,0.45)",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            fontWeight: isActive ? 600 : 400,
                                            padding: "6px 8px",
                                            textAlign: "left",
                                        }}
                                        type="button"
                                    >
                                        {entry.title}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>
            </aside>

            <main
                style={{
                    background: "#fafafa",
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    minHeight: 0,
                    minWidth: 0,
                    padding: "24px 32px 32px",
                }}
            >
                <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
            </main>
        </div>
    );
}
