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
        <div className="flex min-h-screen flex-col">
            {/* Hero */}
            <div className="hero bg-[#222324] text-white">
                <div className="relative z-10 mx-auto max-w-6xl px-8 py-8">
                    <p className="mb-5 font-mono text-xs font-medium uppercase tracking-widest text-[var(--accent)] opacity-70">
                        @legendapp/list
                    </p>
                    <h1 className="m-0 text-5xl leading-none font-bold">{heading}</h1>
                    <p className="mt-4 max-w-xl text-base leading-7 text-white/65">{subheading}</p>
                </div>
            </div>

            {/* Content */}
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-8 pt-12 pb-24">
                {sections.map((section) => (
                    <section className="flex flex-col gap-4" key={section.title}>
                        <div className="flex items-center gap-2.5">
                            <div className="h-px w-4 bg-[var(--accent)] opacity-50" />
                            <span className="text-xs font-semibold uppercase tracking-widest text-[#aaa]">
                                {section.title}
                            </span>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3">
                            {section.entries.map((entry) => (
                                <button
                                    className="catalog-card flex cursor-pointer flex-col items-start gap-1.5 rounded-xl border border-[#ebebeb] bg-white p-5 text-left"
                                    key={entry.slug}
                                    onClick={() => onOpen(entry.slug)}
                                    type="button"
                                >
                                    <div className="flex w-full items-center justify-between gap-2">
                                        <span className="text-sm font-semibold text-[#111]">{entry.title}</span>
                                        <span className="card-arrow shrink-0 text-sm font-light text-[var(--accent)]">
                                            &rarr;
                                        </span>
                                    </div>
                                    <div className="text-sm leading-6 text-[#888]">{entry.description}</div>
                                </button>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
