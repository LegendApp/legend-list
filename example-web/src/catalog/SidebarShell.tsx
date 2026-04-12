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
                    background: "#111",
                    display: "flex",
                    flexDirection: "column",
                    flexShrink: 0,
                    overflowY: "auto",
                    width: 240,
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
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: -0.3,
                        padding: "18px 20px",
                        textAlign: "left",
                    }}
                    type="button"
                >
                    {heading}
                </button>

                <nav style={{ display: "flex", flexDirection: "column", gap: 20, padding: "16px 10px 24px" }}>
                    {sections.map((section) => (
                        <div key={section.title} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <div
                                style={{
                                    color: "rgba(255,255,255,0.3)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    letterSpacing: 1,
                                    padding: "0 10px 6px",
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
                                            background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                                            border: "none",
                                            borderRadius: 6,
                                            color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            fontWeight: isActive ? 600 : 400,
                                            padding: "6px 10px",
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
                    padding: "24px 28px 32px",
                }}
            >
                <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
            </main>
        </div>
    );
}
