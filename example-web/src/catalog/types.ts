export type CatalogEntry = {
    slug: string;
    tags: string[];
    title: string;
};

export type CatalogSection = {
    entries: CatalogEntry[];
    title: string;
};
