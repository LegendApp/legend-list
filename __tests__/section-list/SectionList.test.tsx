import React from "react";
import TestRenderer from "react-test-renderer";

import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

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
});

beforeEach(() => {
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

        TestRenderer.create(
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
    });

    it("translates viewability callbacks to SectionList tokens", async () => {
        const { SectionList } = await import("../../src/section-list/SectionList");
        const viewable: any[] = [];

        TestRenderer.create(
            <SectionList
                onViewableItemsChanged={({ viewableItems }) => viewable.push(...viewableItems)}
                renderItem={({ item }) => <>{item}</>}
                renderSectionHeader={({ section }) => <>{section.key}</>}
                sections={[{ data: ["a"], key: "one" }]}
            />,
        );

        const props = legendListProps.at(-1);
        const [header, item] = props.data;

        props.onViewableItemsChanged({
            changed: [{ containerId: 0, index: 1, isViewable: false, item, key: item.key }],
            viewableItems: [
                { containerId: 0, index: 0, isViewable: true, item: header, key: header.key },
                { containerId: 0, index: 1, isViewable: true, item, key: item.key },
            ],
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
