import React from "react";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render } from "../helpers/testingLibrary";

import "../setup";

import { buildSectionListData } from "../../src/section-list/flattenSections";
import type { SectionListRef } from "../../src/section-list/SectionList";

const legendListProps: any[] = [];
const scrollCalls: any[] = [];

function registerLegendListMock() {
    mock.module("@/components/LegendList", () => {
        const LegendList = React.forwardRef((props: any, ref) => {
            legendListProps.push(props);
            React.useImperativeHandle(ref, () => ({
                getScrollableNode: () => null,
                getScrollResponder: () => ({}),
                getState: () => ({}) as any,
                scrollIndexIntoView: () => {},
                scrollItemIntoView: () => {},
                scrollToEnd: () => {},
                scrollToIndex: (params: any) => scrollCalls.push(params),
                scrollToOffset: () => {},
                setScrollProcessingEnabled: () => {},
                setVisibleContentAnchorOffset: () => {},
            }));
            return null;
        });
        LegendList.displayName = "LegendListMock";
        return { LegendList };
    });
}

beforeEach(() => {
    registerLegendListMock();
    legendListProps.length = 0;
    scrollCalls.length = 0;
});

describe("buildSectionListData", () => {
    it("flattens sections and generates sticky header indices", () => {
        const sections = [
            { data: ["one", "two"], key: "a" },
            { data: [], key: "b" },
        ];

        const { data, stickyHeaderIndices, sectionMeta } = buildSectionListData({
            ItemSeparatorComponent: () => null,
            keyExtractor: (item: string) => item,
            renderSectionFooter: () => null,
            renderSectionHeader: () => null,
            SectionSeparatorComponent: () => null,
            sections,
            stickySectionHeadersEnabled: true,
        });

        expect(stickyHeaderIndices).toEqual([0, 6]);
        expect(sectionMeta).toEqual([
            { footer: 4, header: 0, items: [1, 3] },
            { footer: 7, header: 6, items: [] },
        ]);
        expect(data.map((item) => item.kind)).toEqual([
            "header",
            "item",
            "item-separator",
            "item",
            "footer",
            "section-separator",
            "header",
            "footer",
        ]);
    });
});

describe("SectionList", () => {
    it("maps scrollToLocation to the correct flattened index", async () => {
        const { SectionList } = await import("../../src/section-list/SectionList");
        const ref = React.createRef<SectionListRef<string, any>>();

        const { unmount } = render(
            <SectionList
                ref={ref}
                renderItem={({ item }) => <>{item}</>}
                renderSectionHeader={({ section }) => <>{section.key}</>}
                sections={[
                    { data: ["a", "b"], key: "one" },
                    { data: ["c"], key: "two" },
                ]}
            />,
        );

        const props = legendListProps[0];
        expect(props.stickyHeaderIndices).toEqual([0, 3]);

        ref.current?.scrollToLocation({ itemIndex: 0, sectionIndex: 1, viewOffset: 12, viewPosition: 0.5 });
        expect(scrollCalls[0]).toEqual({
            animated: undefined,
            index: 4,
            viewOffset: 12,
            viewPosition: 0.5,
        });

        ref.current?.scrollToLocation({ itemIndex: -1, sectionIndex: 0 });
        expect(scrollCalls[1]).toMatchObject({ index: 0 });

        unmount();
    });

    it("translates viewability callbacks to SectionList tokens", async () => {
        const { SectionList } = await import("../../src/section-list/SectionList");
        const viewable: any[] = [];
        const ranges: any[] = [];

        const { unmount } = render(
            <SectionList
                onViewableItemsChanged={({ viewableItems, start, end, startBuffered, endBuffered }) => {
                    viewable.push(...viewableItems);
                    ranges.push({ end, endBuffered, start, startBuffered });
                }}
                renderItem={({ item }) => <>{item}</>}
                renderSectionHeader={({ section }) => <>{section.key}</>}
                sections={[{ data: ["a"], key: "one" }]}
            />,
        );

        const props = legendListProps.at(-1);
        const [header, sectionItem] = props.data;

        props.onViewableItemsChanged({
            changed: [{ containerId: 0, index: 1, isViewable: false, item: sectionItem, key: sectionItem.key }],
            end: 1,
            endBuffered: 2,
            start: 0,
            startBuffered: 0,
            viewableItems: [
                { containerId: 0, index: 0, isViewable: true, item: header, key: header.key },
                { containerId: 0, index: 1, isViewable: true, item: sectionItem, key: sectionItem.key },
            ],
        });

        expect(viewable).toEqual([
            {
                index: 0,
                isViewable: true,
                item: "a",
                key: sectionItem.key,
                section: sectionItem.section,
            },
        ]);
        expect(ranges).toEqual([{ end: 1, endBuffered: 2, start: 0, startBuffered: 0 }]);

        unmount();
    });

    it("passes SectionList-shaped info to getFixedItemSize", async () => {
        const { SectionList } = await import("../../src/section-list/SectionList");
        const fixedSizes: string[] = [];

        const { unmount } = render(
            <SectionList
                getFixedItemSize={(info) => {
                    switch (info.type) {
                        case "header":
                            fixedSizes.push(`${info.type}:${info.section.key}`);
                            return 32;
                        case "item":
                            fixedSizes.push(`${info.type}:${info.item}:${info.index}`);
                            return 48;
                        default:
                            return undefined;
                    }
                }}
                renderItem={({ item }) => <>{item}</>}
                renderSectionHeader={({ section }) => <>{section.key}</>}
                sections={[{ data: ["a"], key: "one" }]}
            />,
        );

        const props = legendListProps.at(-1);
        expect(props.getFixedItemSize(props.data[0], 0, "header")).toBe(32);
        expect(props.getFixedItemSize(props.data[1], 1, "item")).toBe(48);
        expect(fixedSizes).toEqual(["header:one", "item:a:0"]);

        unmount();
    });

    it("passes footer and separator info to getFixedItemSize", async () => {
        const { SectionList } = await import("../../src/section-list/SectionList");
        const fixedSizes: string[] = [];

        const { unmount } = render(
            <SectionList
                getFixedItemSize={(info) => {
                    switch (info.type) {
                        case "footer":
                            fixedSizes.push(`${info.type}:${info.section.key}`);
                            return 20;
                        case "item-separator":
                            fixedSizes.push(`${info.type}:${info.leadingItem}:${info.trailingItem}`);
                            return 8;
                        case "section-separator":
                            fixedSizes.push(`${info.type}:${info.leadingSection?.key}:${info.trailingSection?.key}`);
                            return 12;
                        default:
                            return undefined;
                    }
                }}
                ItemSeparatorComponent={() => null}
                renderItem={({ item }) => <>{item}</>}
                renderSectionFooter={({ section }) => <>{section.key}</>}
                SectionSeparatorComponent={() => null}
                sections={[
                    { data: ["a", "b"], key: "one" },
                    { data: [], key: "two" },
                ]}
            />,
        );

        const props = legendListProps.at(-1);
        const itemSeparator = props.data.find((item: any) => item.kind === "item-separator");
        const footer = props.data.find((item: any) => item.kind === "footer");
        const sectionSeparator = props.data.find((item: any) => item.kind === "section-separator");

        expect(props.getFixedItemSize(footer, 3, "footer")).toBe(20);
        expect(props.getFixedItemSize(itemSeparator, 1, "item-separator")).toBe(8);
        expect(props.getFixedItemSize(sectionSeparator, 4, "section-separator")).toBe(12);
        expect(fixedSizes).toEqual(["footer:one", "item-separator:a:b", "section-separator:one:two"]);

        unmount();
    });

    it("passes matching item info to renderItem and getFixedItemSize", async () => {
        const { SectionList } = await import("../../src/section-list/SectionList");
        const renderItemInfo: string[] = [];
        const fixedSizeInfo: string[] = [];

        const { unmount } = render(
            <SectionList
                getFixedItemSize={(info) => {
                    if (info.type === "item") {
                        fixedSizeInfo.push(`${info.section.key}:${info.item}:${info.index}`);
                    }
                    return undefined;
                }}
                renderItem={({ item, index, section }) => {
                    renderItemInfo.push(`${section.key}:${item}:${index}`);
                    return <>{item}</>;
                }}
                sections={[{ data: ["a"], key: "one" }]}
            />,
        );

        const props = legendListProps.at(-1);
        const sectionItem = props.data.find((item: any) => item.kind === "item");

        props.renderItem({ index: 0, item: sectionItem });
        props.getFixedItemSize(sectionItem, 0, "item");

        expect(renderItemInfo).toEqual(["one:a:0"]);
        expect(fixedSizeInfo).toEqual(renderItemInfo);

        unmount();
    });
});
