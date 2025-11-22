import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import React from "react";
import TestRenderer from "react-test-renderer";

import "../setup";

import { buildSectionListData } from "../../src/section-list/flattenSections";
import type { SectionListRef } from "../../src/section-list/SectionList";

const legendListProps: any[] = [];
const scrollCalls: any[] = [];

beforeAll(() => {
    mock.module("@/components/LegendList", () => {
        const LegendList = React.forwardRef((props: any, ref) => {
            legendListProps.push(props);
            React.useImperativeHandle(ref, () => ({
                scrollToIndex: (params: any) => scrollCalls.push(params),
                scrollToEnd: () => {},
                scrollToOffset: () => {},
                scrollIndexIntoView: () => {},
                scrollItemIntoView: () => {},
                getScrollResponder: () => ({}),
                getScrollableNode: () => null,
                getState: () => ({} as any),
                setVisibleContentAnchorOffset: () => {},
                setScrollProcessingEnabled: () => {},
            }));
            return null;
        });
        LegendList.displayName = "LegendListMock";
        return { LegendList };
    });
});

beforeEach(() => {
    legendListProps.length = 0;
    scrollCalls.length = 0;
});

describe("buildSectionListData", () => {
    it("flattens sections and generates sticky header indices", () => {
        const sections = [
            { key: "a", data: ["one", "two"] },
            { key: "b", data: [] },
        ];

        const { data, stickyHeaderIndices, sectionMeta } = buildSectionListData({
            sections,
            renderSectionHeader: () => null,
            renderSectionFooter: () => null,
            ItemSeparatorComponent: () => null,
            SectionSeparatorComponent: () => null,
            stickySectionHeadersEnabled: true,
            keyExtractor: (item: string) => item,
        });

        expect(stickyHeaderIndices).toEqual([0, 6]);
        expect(sectionMeta).toEqual([
            { header: 0, items: [1, 3], footer: 4 },
            { header: 6, items: [], footer: 7 },
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

        TestRenderer.create(
            <SectionList
                ref={ref}
                sections={[
                    { key: "one", data: ["a", "b"] },
                    { key: "two", data: ["c"] },
                ]}
                renderItem={({ item }) => <>{item}</>}
                renderSectionHeader={({ section }) => <>{section.key}</>}
            />,
        );

        const props = legendListProps[0];
        expect(props.stickyHeaderIndices).toEqual([0, 3]);

        ref.current?.scrollToLocation({ sectionIndex: 1, itemIndex: 0, viewOffset: 12, viewPosition: 0.5 });
        expect(scrollCalls[0]).toEqual({
            animated: undefined,
            index: 4,
            viewOffset: 12,
            viewPosition: 0.5,
        });

        ref.current?.scrollToLocation({ sectionIndex: 0, itemIndex: -1 });
        expect(scrollCalls[1]).toMatchObject({ index: 0 });
    });

    it("translates viewability callbacks to SectionList tokens", async () => {
        const { SectionList } = await import("../../src/section-list/SectionList");
        const viewable: any[] = [];

        TestRenderer.create(
            <SectionList
                sections={[{ key: "one", data: ["a"] }]}
                renderItem={({ item }) => <>{item}</>}
                renderSectionHeader={({ section }) => <>{section.key}</>}
                onViewableItemsChanged={({ viewableItems }) => viewable.push(...viewableItems)}
            />,
        );

        const props = legendListProps.at(-1);
        const [header, item] = props.data;

        props.onViewableItemsChanged({
            viewableItems: [
                { item: header, key: header.key, isViewable: true, index: 0, containerId: 0 },
                { item, key: item.key, isViewable: true, index: 1, containerId: 0 },
            ],
            changed: [{ item, key: item.key, isViewable: false, index: 1, containerId: 0 }],
        });

        expect(viewable).toEqual([
            {
                index: 0,
                isViewable: true,
                item: "a",
                key: item.key,
                section: item.section,
            },
        ]);
    });
});
