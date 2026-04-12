export type CatalogEntry = {
    description: string;
    href: string;
    title: string;
};

export type CatalogGroup = {
    entries: CatalogEntry[];
    key: string;
    title: string;
};
