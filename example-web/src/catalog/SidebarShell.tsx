import type { ReactNode } from "react";

import type { CatalogEntry } from "./types";

export function SidebarShell({
    activeSlug,
    children,
    entries,
    heading,
    onOpen,
}: {
    activeSlug: string;
    children: ReactNode;
    entries: CatalogEntry[];
    heading: string;
    onOpen: (slug: string) => void;
}) {
    return (
        <div style={{ height: "100vh", overflow: "hidden" }}>
            <aside
                style={{
                    borderRight: "1px solid #E6EAF0",
                    bottom: 16,
                    left: 16,
                    overflowY: "auto",
                    paddingRight: 12,
                    position: "fixed",
                    top: 16,
                    width: 260,
                }}
            >
                <h1 style={{ fontSize: 24, margin: "0 0 18px" }}>{heading}</h1>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {entries.map((entry) => {
                        const isActive = entry.slug === activeSlug;
                        return (
                            <button
                                key={entry.slug}
                                onClick={() => onOpen(entry.slug)}
                                style={{
                                    background: isActive ? "#EEF6FF" : "#FFFFFF",
                                    border: isActive ? "1px solid #8AB4F8" : "1px solid #E6EAF0",
                                    borderRadius: 12,
                                    cursor: "pointer",
                                    padding: "10px 12px",
                                    textAlign: "left",
                                }}
                                type="button"
                            >
                                <div style={{ fontSize: 15, fontWeight: 700 }}>{entry.title}</div>
                                <div
                                    style={{
                                        color: "#5F6C7B",
                                        display: "flex",
                                        flexWrap: "wrap",
                                        fontSize: 12,
                                        gap: 6,
                                        marginTop: 6,
                                    }}
                                >
                                    {entry.tags.map((tag) => (
                                        <span key={tag}>{tag}</span>
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>
            <main
                style={{
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    height: "100vh",
                    marginLeft: 304,
                    minHeight: 0,
                    minWidth: 0,
                    padding: "24px 24px 32px 0",
                }}
            >
                <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
            </main>
        </div>
    );
}
