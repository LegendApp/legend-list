import * as React from "react";
import {
    Platform,
    type SectionBase,
    type SectionListData,
    type SectionListRenderItemInfo,
    type SectionListScrollParams,
} from "react-native";

import type { LegendListProps, LegendListRef, LegendListRenderItemProps, ViewToken } from "@legendapp/list";
import { LegendList, typedForwardRef, typedMemo } from "@legendapp/list";
import {
    type BuildSectionListDataResult,
    buildSectionListData,
    type FlatSectionListItem,
    type SectionListSeparatorProps,
} from "./flattenSections";

export type SectionListViewToken<ItemT, SectionT> = {
    item: ItemT;
    key: string;
    index: number;
    isViewable: boolean;
    section: SectionListData<ItemT, SectionT>;
};

export type SectionListOnViewableItemsChanged<ItemT, SectionT> =
    | ((info: {
          viewableItems: Array<SectionListViewToken<ItemT, SectionT>>;
          changed: Array<SectionListViewToken<ItemT, SectionT>>;
      }) => void)
    | null;

type SectionListLegendProps<ItemT, SectionT> = Omit<
    LegendListProps<FlatSectionListItem<ItemT, SectionT>>,
    | "data"
    | "children"
    | "renderItem"
    | "keyExtractor"
    | "ItemSeparatorComponent"
    | "getItemType"
    | "getFixedItemSize"
    | "stickyHeaderIndices"
    | "numColumns"
    | "columnWrapperStyle"
    | "onViewableItemsChanged"
>;

export type SectionListProps<ItemT, SectionT extends SectionBase<ItemT> = SectionBase<ItemT>> = SectionListLegendProps<
    ItemT,
    SectionT
> & {
    sections: ReadonlyArray<SectionListData<ItemT, SectionT>>;
    extraData?: any;
    renderItem?: (info: SectionListRenderItemInfo<ItemT, SectionT>) => React.ReactElement | null;
    renderSectionHeader?: (info: { section: SectionListData<ItemT, SectionT> }) => React.ReactElement | null;
    renderSectionFooter?: (info: { section: SectionListData<ItemT, SectionT> }) => React.ReactElement | null;
    ItemSeparatorComponent?: React.ComponentType<SectionListSeparatorProps<ItemT, SectionT>> | null;
    SectionSeparatorComponent?:
        | React.ComponentType<SectionListSeparatorProps<ItemT, SectionT>>
        | React.ReactElement
        | null;
    keyExtractor?: (item: ItemT, index: number) => string;
    stickySectionHeadersEnabled?: boolean;
    onViewableItemsChanged?: SectionListOnViewableItemsChanged<ItemT, SectionT>;
};

export type SectionListRef = LegendListRef & {
    scrollToLocation(params: SectionListScrollParams): void;
};

type SectionListComponentProps<ItemT, SectionT extends SectionBase<ItemT>> = SectionListProps<ItemT, SectionT>;

const defaultSeparators = {
    highlight: () => {},
    unhighlight: () => {},
    updateProps: () => {},
};

function resolveSeparatorComponent<Props>(
    component: React.ComponentType<Props> | React.ReactElement | null | undefined,
    props: Props,
) {
    if (!component) return null;
    if (React.isValidElement(component)) {
        return component;
    }
    const Component = component as any;
    return <Component {...props} />;
}

export const SectionList = typedMemo(
    typedForwardRef(function SectionListInner<ItemT, SectionT extends SectionBase<ItemT>>(
        props: SectionListComponentProps<ItemT, SectionT>,
        ref: React.ForwardedRef<SectionListRef>,
    ) {
        const {
            sections,
            renderItem: renderItemProp,
            renderSectionHeader,
            renderSectionFooter,
            ItemSeparatorComponent,
            SectionSeparatorComponent,
            stickySectionHeadersEnabled = Platform.OS === "ios",
            keyExtractor,
            extraData,
            onViewableItemsChanged,
            horizontal,
            ...restProps
        } = props;

        const legendListRef = React.useRef<LegendListRef>(null);

        const flattened: BuildSectionListDataResult<ItemT, SectionListData<ItemT, SectionT>> = React.useMemo(
            () =>
                buildSectionListData<ItemT, SectionListData<ItemT, SectionT>>({
                    ItemSeparatorComponent,
                    keyExtractor,
                    renderSectionFooter,
                    renderSectionHeader,
                    SectionSeparatorComponent,
                    sections,
                    stickySectionHeadersEnabled: !horizontal && stickySectionHeadersEnabled,
                }),
            [
                sections,
                extraData,
                renderSectionHeader,
                renderSectionFooter,
                ItemSeparatorComponent,
                SectionSeparatorComponent,
                stickySectionHeadersEnabled,
                keyExtractor,
                horizontal,
            ],
        );

        const { data, sectionMeta, stickyHeaderIndices } = flattened;

        const handleViewableItemsChanged = React.useMemo(() => {
            if (!onViewableItemsChanged) return undefined;
            return ({
                viewableItems,
                changed,
            }: {
                viewableItems: Array<ViewToken<FlatSectionListItem<ItemT, SectionListData<ItemT, SectionT>>>>;
                changed: Array<ViewToken<FlatSectionListItem<ItemT, SectionListData<ItemT, SectionT>>>>;
            }) => {
                const mapToken = (
                    token: ViewToken<FlatSectionListItem<ItemT, SectionListData<ItemT, SectionT>>>,
                ): SectionListViewToken<ItemT, SectionT> | null => {
                    if (token.item.kind !== "item") return null;
                    return {
                        index: token.item.itemIndex,
                        isViewable: token.isViewable,
                        item: token.item.item,
                        key: token.key,
                        section: token.item.section,
                    };
                };

                const mappedViewable = viewableItems.map(mapToken).filter(Boolean) as Array<
                    SectionListViewToken<ItemT, SectionT>
                >;
                const mappedChanged = changed.map(mapToken).filter(Boolean) as Array<
                    SectionListViewToken<ItemT, SectionT>
                >;

                onViewableItemsChanged({ changed: mappedChanged, viewableItems: mappedViewable });
            };
        }, [onViewableItemsChanged]);

        const renderItem = React.useCallback(
            ({ item }: LegendListRenderItemProps<FlatSectionListItem<ItemT, SectionListData<ItemT, SectionT>>>) => {
                switch (item.kind) {
                    case "header":
                        return renderSectionHeader ? renderSectionHeader({ section: item.section }) : null;
                    case "footer":
                        return renderSectionFooter ? renderSectionFooter({ section: item.section }) : null;
                    case "item": {
                        const render =
                            (item.section.renderItem as SectionListProps<ItemT, SectionT>["renderItem"]) ??
                            renderItemProp;
                        if (!render) return null;
                        return render({
                            index: item.itemIndex,
                            item: item.item,
                            section: item.section,
                            separators: defaultSeparators,
                        });
                    }
                    case "item-separator": {
                        const SeparatorComponent = item.section.ItemSeparatorComponent ?? ItemSeparatorComponent;
                        return resolveSeparatorComponent(SeparatorComponent, {
                            leadingItem: item.leadingItem,
                            leadingSection: item.section,
                            section: item.section,
                            trailingItem: item.trailingItem,
                            trailingSection: item.section,
                        });
                    }
                    case "section-separator":
                        return resolveSeparatorComponent(SectionSeparatorComponent, {
                            leadingItem: undefined,
                            leadingSection: item.leadingSection,
                            section: item.leadingSection,
                            trailingItem: undefined,
                            trailingSection: item.trailingSection,
                        });
                    default:
                        return null;
                }
            },
            [
                ItemSeparatorComponent,
                SectionSeparatorComponent,
                renderItemProp,
                renderSectionFooter,
                renderSectionHeader,
            ],
        );

        const scrollToLocation = React.useCallback(
            ({ sectionIndex, itemIndex, viewOffset, viewPosition, animated }: SectionListScrollParams) => {
                const meta = sectionMeta[sectionIndex];
                if (!meta) return;
                const target = itemIndex === -1 ? (meta.header ?? meta.items[0] ?? meta.footer) : meta.items[itemIndex];
                if (target === undefined) return;

                legendListRef.current?.scrollToIndex({
                    animated,
                    index: target,
                    viewOffset,
                    viewPosition,
                });
            },
            [sectionMeta],
        );

        React.useImperativeHandle(
            ref,
            () => ({
                ...(legendListRef.current as LegendListRef),
                scrollToLocation,
            }),
            [scrollToLocation],
        );

        return (
            <LegendList
                {...restProps}
                columnWrapperStyle={undefined}
                data={data}
                getItemType={(item) => item.kind}
                keyExtractor={(item) => item.key}
                numColumns={1}
                onViewableItemsChanged={handleViewableItemsChanged}
                ref={legendListRef}
                renderItem={renderItem}
                stickyHeaderIndices={!horizontal ? stickyHeaderIndices : undefined}
            />
        );
    }),
);
