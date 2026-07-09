import type * as React from "react";
import type { SectionListData } from "react-native";

export type SectionListSeparatorProps<ItemT, SectionT> = {
    leadingItem?: ItemT;
    leadingSection?: SectionListData<ItemT, SectionT>;
    section: SectionListData<ItemT, SectionT>;
    trailingItem?: ItemT;
    trailingSection?: SectionListData<ItemT, SectionT>;
};

export type SectionHeaderItem<SectionT> = {
    kind: "header";
    key: string;
    section: SectionT;
    sectionIndex: number;
};

export type SectionFooterItem<SectionT> = {
    kind: "footer";
    key: string;
    section: SectionT;
    sectionIndex: number;
};

export type SectionBodyItem<ItemT, SectionT> = {
    kind: "item";
    key: string;
    section: SectionT;
    sectionIndex: number;
    item: ItemT;
    itemIndex: number;
    absoluteItemIndex: number;
};

export type SectionItemSeparator<ItemT, SectionT> = {
    kind: "item-separator";
    key: string;
    section: SectionT;
    sectionIndex: number;
    leadingItem: ItemT;
    leadingItemIndex: number;
    trailingItem?: ItemT;
};

export type SectionSeparator<SectionT> = {
    kind: "section-separator";
    key: string;
    leadingSection: SectionT;
    leadingSectionIndex: number;
    trailingSection?: SectionT;
};

export type FlatSectionListItem<ItemT, SectionT> =
    | SectionHeaderItem<SectionT>
    | SectionFooterItem<SectionT>
    | SectionBodyItem<ItemT, SectionT>
    | SectionItemSeparator<ItemT, SectionT>
    | SectionSeparator<SectionT>;

export type SectionMeta = {
    header?: number;
    footer?: number;
    items: number[];
};

export type BuildSectionListDataResult<ItemT, SectionT> = {
    data: Array<FlatSectionListItem<ItemT, SectionT>>;
    sectionMeta: SectionMeta[];
    stickyHeaderIndices: number[];
};

type BuildSectionListDataOptions<ItemT, SectionT> = {
    sections: ReadonlyArray<SectionListData<ItemT, SectionT>>;
    renderSectionHeader?:
        | ((info: { section: SectionListData<ItemT, SectionT> }) => React.ReactElement | null)
        | undefined;
    renderSectionFooter?:
        | ((info: { section: SectionListData<ItemT, SectionT> }) => React.ReactElement | null)
        | undefined;
    ItemSeparatorComponent?: React.ComponentType<any> | null | undefined;
    SectionSeparatorComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    stickySectionHeadersEnabled: boolean | undefined;
    keyExtractor?: (item: ItemT, index: number) => string;
};

const defaultKeyExtractor = (item: any, index: number) => {
    const key = item?.key ?? item?.id;
    return key != null ? String(key) : String(index);
};

const getSectionKey = <ItemT, SectionT>(section: SectionListData<ItemT, SectionT>, sectionIndex: number) =>
    section.key ?? `section-${sectionIndex}`;

export function buildSectionListData<ItemT, SectionT>({
    sections,
    renderSectionHeader,
    renderSectionFooter,
    ItemSeparatorComponent,
    SectionSeparatorComponent,
    stickySectionHeadersEnabled,
    keyExtractor = defaultKeyExtractor,
}: BuildSectionListDataOptions<ItemT, SectionT>): BuildSectionListDataResult<ItemT, SectionT> {
    const data: Array<FlatSectionListItem<ItemT, SectionT>> = [];
    const sectionMeta: SectionMeta[] = [];
    const stickyHeaderIndices: number[] = [];
    let absoluteItemIndex = 0;

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const section = sections[sectionIndex];
        const items = section.data ?? [];
        const meta: SectionMeta = { items: [] };
        const sectionKey = getSectionKey(section, sectionIndex);

        const hasHeader = typeof renderSectionHeader === "function";
        const hasFooter = typeof renderSectionFooter === "function";
        const hasItemSeparator = Boolean(ItemSeparatorComponent || section.ItemSeparatorComponent);
        const hasSectionSeparator = Boolean(SectionSeparatorComponent);

        if (hasHeader) {
            const headerIndex = data.length;
            data.push({
                key: `${sectionKey}:header`,
                kind: "header",
                section,
                sectionIndex,
            });
            meta.header = headerIndex;
            if (stickySectionHeadersEnabled) {
                stickyHeaderIndices.push(headerIndex);
            }
        }

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            const item = items[itemIndex] as ItemT;
            const itemKeyExtractor = section.keyExtractor ?? keyExtractor;
            const itemKey = itemKeyExtractor(item, itemIndex);

            data.push({
                absoluteItemIndex: absoluteItemIndex++,
                item,
                itemIndex,
                key: `${sectionKey}:item:${itemKey}`,
                kind: "item",
                section,
                sectionIndex,
            });
            meta.items.push(data.length - 1);

            if (hasItemSeparator && itemIndex < items.length - 1) {
                data.push({
                    key: `${sectionKey}:separator:${itemIndex}`,
                    kind: "item-separator",
                    leadingItem: item,
                    leadingItemIndex: itemIndex,
                    section,
                    sectionIndex,
                    trailingItem: items[itemIndex + 1] as ItemT,
                });
            }
        }

        if (hasFooter) {
            data.push({
                key: `${sectionKey}:footer`,
                kind: "footer",
                section,
                sectionIndex,
            });
            meta.footer = data.length - 1;
        }

        const isLastSection = sectionIndex === sections.length - 1;
        if (hasSectionSeparator && !isLastSection) {
            data.push({
                key: `${sectionKey}:section-separator`,
                kind: "section-separator",
                leadingSection: section,
                leadingSectionIndex: sectionIndex,
                trailingSection: sections[sectionIndex + 1],
            });
        }

        sectionMeta.push(meta);
    }

    return { data, sectionMeta, stickyHeaderIndices };
}
