export type CatalogEntry = {
    description: string;
    slug: string;
    title: string;
};

export type CatalogSection = {
    entries: CatalogEntry[];
    title: string;
};
