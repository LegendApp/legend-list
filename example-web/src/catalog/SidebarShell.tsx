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
        <div className="flex h-screen overflow-hidden">
            <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-r-white/[0.06] bg-[#0c0c0c]">
                <button
                    className="sidebar-home-link cursor-pointer border-0 border-b border-b-white/[0.06] bg-transparent px-4 py-4 text-left text-sm font-bold tracking-tight text-white"
                    onClick={onGoHome}
                    type="button"
                >
                    {heading}
                </button>

                <nav className="flex flex-col gap-5 px-2.5 pt-3.5 pb-6">
                    {sections.map((section) => (
                        <div className="flex flex-col gap-px" key={section.title}>
                            <div className="px-2 pb-1 font-mono text-xs font-medium uppercase tracking-widest text-white/30">
                                {section.title}
                            </div>
                            {section.entries.map((entry) => {
                                const isActive = entry.slug === activeSlug;
                                return (
                                    <button
                                        className={`sidebar-item cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm ${
                                            isActive
                                                ? "bg-[#0099dd44] font-semibold text-[var(--accent)]"
                                                : "font-medium text-white/60"
                                        }`}
                                        key={entry.slug}
                                        onClick={() => onOpen(entry.slug)}
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

            <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#fafafa] px-8 pt-4 pb-8">
                <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
            </main>
        </div>
    );
}
