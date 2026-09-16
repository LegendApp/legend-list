import type { LegendListDataSource } from "@legendapp/list/react-native";

interface Item {
    id: string;
}
declare const source: LegendListDataSource<Item>;

import { LegendList as Web } from "@legendapp/list/react";

const WebExplicit = (
    <Web<Item>
        dataSource={source}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item | undefined = item;
            void value;
            // @ts-expect-error Source events can describe unloaded rows.
            const loaded: Item = item;
            void loaded;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item | undefined = itemData;
            void value;
            // @ts-expect-error Placeholder measurements have no item.
            const loaded: Item = itemData;
            void loaded;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item | undefined = viewableItems[0].item;
            void value;
            // @ts-expect-error Visible rows may be unloaded.
            const loaded: Item = viewableItems[0].item;
            void loaded;
        }}
        renderItem={({ item }) => item?.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item | undefined = changed[0].item;
                    void value;
                    // @ts-expect-error Configured events may describe unloaded rows.
                    const loaded: Item = changed[0].item;
                    void loaded;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void WebExplicit;
const WebArray = (
    <Web
        data={[{ id: "a" }]}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item = item;
            void value;
            // @ts-expect-error Do not silently weaken array inference to any.
            item.unknownProperty;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item = itemData;
            // @ts-expect-error Preserve the inferred array item type.
            itemData.unknownProperty;
            void value;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item = viewableItems[0].item;
            // @ts-expect-error Preserve the inferred array item type.
            viewableItems[0].item.unknownProperty;
            void value;
        }}
        renderItem={({ item }) => item.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item = changed[0].item;
                    // @ts-expect-error Preserve the inferred array item type.
                    changed[0].item.unknownProperty;
                    void value;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void WebArray;

import { LegendList as Native } from "@legendapp/list/react-native";

const NativeExplicit = (
    <Native<Item>
        dataSource={source}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item | undefined = item;
            void value;
            // @ts-expect-error Source events can describe unloaded rows.
            const loaded: Item = item;
            void loaded;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item | undefined = itemData;
            void value;
            // @ts-expect-error Placeholder measurements have no item.
            const loaded: Item = itemData;
            void loaded;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item | undefined = viewableItems[0].item;
            void value;
            // @ts-expect-error Visible rows may be unloaded.
            const loaded: Item = viewableItems[0].item;
            void loaded;
        }}
        renderItem={({ item }) => item?.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item | undefined = changed[0].item;
                    void value;
                    // @ts-expect-error Configured events may describe unloaded rows.
                    const loaded: Item = changed[0].item;
                    void loaded;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void NativeExplicit;
const NativeArray = (
    <Native
        data={[{ id: "a" }]}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item = item;
            void value;
            // @ts-expect-error Do not silently weaken array inference to any.
            item.unknownProperty;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item = itemData;
            // @ts-expect-error Preserve the inferred array item type.
            itemData.unknownProperty;
            void value;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item = viewableItems[0].item;
            // @ts-expect-error Preserve the inferred array item type.
            viewableItems[0].item.unknownProperty;
            void value;
        }}
        renderItem={({ item }) => item.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item = changed[0].item;
                    // @ts-expect-error Preserve the inferred array item type.
                    changed[0].item.unknownProperty;
                    void value;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void NativeArray;

import { AnimatedLegendList as Reanimated } from "@legendapp/list/reanimated";

const ReanimatedExplicit = (
    <Reanimated<Item>
        dataSource={source}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item | undefined = item;
            void value;
            // @ts-expect-error Source events can describe unloaded rows.
            const loaded: Item = item;
            void loaded;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item | undefined = itemData;
            void value;
            // @ts-expect-error Placeholder measurements have no item.
            const loaded: Item = itemData;
            void loaded;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item | undefined = viewableItems[0].item;
            void value;
            // @ts-expect-error Visible rows may be unloaded.
            const loaded: Item = viewableItems[0].item;
            void loaded;
        }}
        renderItem={({ item }) => item?.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item | undefined = changed[0].item;
                    void value;
                    // @ts-expect-error Configured events may describe unloaded rows.
                    const loaded: Item = changed[0].item;
                    void loaded;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void ReanimatedExplicit;
const ReanimatedArray = (
    <Reanimated
        data={[{ id: "a" }]}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item = item;
            void value;
            // @ts-expect-error Do not silently weaken array inference to any.
            item.unknownProperty;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item = itemData;
            // @ts-expect-error Preserve the inferred array item type.
            itemData.unknownProperty;
            void value;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item = viewableItems[0].item;
            // @ts-expect-error Preserve the inferred array item type.
            viewableItems[0].item.unknownProperty;
            void value;
        }}
        renderItem={({ item }) => item.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item = changed[0].item;
                    // @ts-expect-error Preserve the inferred array item type.
                    changed[0].item.unknownProperty;
                    void value;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void ReanimatedArray;

import { KeyboardAwareLegendList as Keyboard } from "@legendapp/list/keyboard";

const KeyboardExplicit = (
    <Keyboard<Item>
        dataSource={source}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item | undefined = item;
            void value;
            // @ts-expect-error Source events can describe unloaded rows.
            const loaded: Item = item;
            void loaded;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item | undefined = itemData;
            void value;
            // @ts-expect-error Placeholder measurements have no item.
            const loaded: Item = itemData;
            void loaded;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item | undefined = viewableItems[0].item;
            void value;
            // @ts-expect-error Visible rows may be unloaded.
            const loaded: Item = viewableItems[0].item;
            void loaded;
        }}
        renderItem={({ item }) => item?.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item | undefined = changed[0].item;
                    void value;
                    // @ts-expect-error Configured events may describe unloaded rows.
                    const loaded: Item = changed[0].item;
                    void loaded;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void KeyboardExplicit;
const KeyboardArray = (
    <Keyboard
        data={[{ id: "a" }]}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item = item;
            void value;
            // @ts-expect-error Do not silently weaken array inference to any.
            item.unknownProperty;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item = itemData;
            // @ts-expect-error Preserve the inferred array item type.
            itemData.unknownProperty;
            void value;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item = viewableItems[0].item;
            // @ts-expect-error Preserve the inferred array item type.
            viewableItems[0].item.unknownProperty;
            void value;
        }}
        renderItem={({ item }) => item.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item = changed[0].item;
                    // @ts-expect-error Preserve the inferred array item type.
                    changed[0].item.unknownProperty;
                    void value;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void KeyboardArray;

import { KeyboardAvoidingLegendList as KeyboardLegacy } from "@legendapp/list/keyboard-legacy";

const KeyboardLegacyExplicit = (
    <KeyboardLegacy<Item>
        dataSource={source}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item | undefined = item;
            void value;
            // @ts-expect-error Source events can describe unloaded rows.
            const loaded: Item = item;
            void loaded;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item | undefined = itemData;
            void value;
            // @ts-expect-error Placeholder measurements have no item.
            const loaded: Item = itemData;
            void loaded;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item | undefined = viewableItems[0].item;
            void value;
            // @ts-expect-error Visible rows may be unloaded.
            const loaded: Item = viewableItems[0].item;
            void loaded;
        }}
        renderItem={({ item }) => item?.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item | undefined = changed[0].item;
                    void value;
                    // @ts-expect-error Configured events may describe unloaded rows.
                    const loaded: Item = changed[0].item;
                    void loaded;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void KeyboardLegacyExplicit;
const KeyboardLegacyArray = (
    <KeyboardLegacy
        data={[{ id: "a" }]}
        onFirstVisibleItemChanged={({ item }) => {
            const value: Item = item;
            void value;
            // @ts-expect-error Do not silently weaken array inference to any.
            item.unknownProperty;
        }}
        onItemSizeChanged={({ itemData }) => {
            const value: Item = itemData;
            // @ts-expect-error Preserve the inferred array item type.
            itemData.unknownProperty;
            void value;
        }}
        onViewableItemsChanged={({ viewableItems }) => {
            const value: Item = viewableItems[0].item;
            // @ts-expect-error Preserve the inferred array item type.
            viewableItems[0].item.unknownProperty;
            void value;
        }}
        renderItem={({ item }) => item.id}
        viewabilityConfigCallbackPairs={[
            {
                onViewableItemsChanged: ({ changed }) => {
                    const value: Item = changed[0].item;
                    // @ts-expect-error Preserve the inferred array item type.
                    changed[0].item.unknownProperty;
                    void value;
                },
                viewabilityConfig: {},
            },
        ]}
    />
);
void KeyboardLegacyArray;
