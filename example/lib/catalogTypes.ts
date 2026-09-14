export type CatalogAction = {
    href: string;
    label: string;
};

type CatalogEntryBase = {
    description: string;
    id: string;
    title: string;
};

export type CatalogEntry = CatalogEntryBase &
    (
        | {
              actions: CatalogAction[];
              href?: never;
          }
        | {
              actions?: never;
              href: string;
          }
    );

export type CatalogGroup = {
    entries: CatalogEntry[];
    key: string;
    title: string;
};
