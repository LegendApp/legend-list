export type CatalogEntry = {
    href: string;
    tags: string[];
    title: string;
};

export type CatalogGroup = {
    entries: CatalogEntry[];
    key: string;
    title: string;
};
