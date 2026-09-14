import type { LegendListDataSource } from "@legendapp/list/react-native";

interface Item {
    id: string;
}
declare const source: LegendListDataSource<Item>;

import { LegendList as Web } from "@legendapp/list/react";

const WebInferred = (
    <Web
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
void WebInferred;

import { LegendList as Native } from "@legendapp/list/react-native";

const NativeInferred = (
    <Native
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
void NativeInferred;

import { AnimatedLegendList as Reanimated } from "@legendapp/list/reanimated";

const ReanimatedInferred = (
    <Reanimated
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
void ReanimatedInferred;

import { KeyboardAwareLegendList as Keyboard } from "@legendapp/list/keyboard";

const KeyboardInferred = (
    <Keyboard
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
void KeyboardInferred;

import { KeyboardAvoidingLegendList as KeyboardLegacy } from "@legendapp/list/keyboard-legacy";

const KeyboardLegacyInferred = (
    <KeyboardLegacy
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
void KeyboardLegacyInferred;

import type { AnimatedLegendListPropsBase } from "@legendapp/list/reanimated";

const base: AnimatedLegendListPropsBase<Item> = {
    data: [],
    onFirstVisibleItemChanged: ({ item }) => {
        item.id;
    },
};
void base;
