import type * as React from "react";

import { KeyboardAwareLegendList } from "@legendapp/list/keyboard";
import { KeyboardAvoidingLegendList } from "@legendapp/list/keyboard-legacy";
import {
    LegendList as Web,
    type LegendListComponent as WebComponent,
    type LegendListProps as WebProps,
} from "@legendapp/list/react";
import {
    LegendList,
    type LegendListComponent,
    type LegendListProps,
    type LegendListRef,
    type LegendListState,
} from "@legendapp/list/react-native";
import {
    AnimatedLegendList,
    type AnimatedLegendListProps,
    type AnimatedLegendListPropsBase,
} from "@legendapp/list/reanimated";
import { SectionList, type SectionListProps } from "@legendapp/list/section-list";

interface Item {
    id: string;
}

// Main-era generic wrappers use ordinary Omit and retain contextual item typing.
type WrapperProps<T> = Omit<LegendListProps<T>, "keyExtractor"> & { label?: string };
function Wrapper<T>(props: WrapperProps<T>) {
    return <LegendList {...props} />;
}
const nativeWrapper = (
    <Wrapper
        data={[{ id: "a" }]}
        renderItem={({ item }) => {
            // @ts-expect-error The wrapper must infer Item, not any.
            item.unknown;
            return item.id;
        }}
    />
);
function WebWrapper<T>(props: Omit<WebProps<T>, "keyExtractor">) {
    return <Web {...props} />;
}
const webWrapper = (
    <WebWrapper
        data={[{ id: "a" }]}
        renderItem={({ item }) => {
            // @ts-expect-error Web wrappers must retain the item type too.
            item.unknown;
            return item.id;
        }}
    />
);

interface MyAnimatedProps<T> extends AnimatedLegendListPropsBase<T> {
    label?: string;
}
const animatedBase: MyAnimatedProps<Item> = { data: [], label: "Rows" };
const animatedProps: Omit<AnimatedLegendListProps<Item>, "keyExtractor"> = {
    data: [],
    renderItem: ({ item }) => {
        // @ts-expect-error Animated wrapper props must retain contextual typing.
        item.unknown;
        return item.id;
    },
};
const animated = <AnimatedLegendList {...animatedProps} />;
const keyboardProps: Omit<React.ComponentProps<typeof KeyboardAwareLegendList>, "keyExtractor"> = {
    data: [],
    renderItem: ({ item }) => String(item),
};
const keyboard = <KeyboardAwareLegendList {...keyboardProps} />;
const keyboardLegacyProps: Omit<React.ComponentProps<typeof KeyboardAvoidingLegendList>, "keyExtractor"> = {
    data: [],
    renderItem: ({ item }) => String(item),
};
const keyboardLegacy = <KeyboardAvoidingLegendList {...keyboardLegacyProps} />;

// A handwritten v3 ref need not implement the newly added interaction method.
declare const state: LegendListState;
const mockRef: LegendListRef = {
    clearCaches() {},
    flashScrollIndicators() {},
    getAnimatableRef: () => null!,
    getNativeScrollRef: () => null!,
    getScrollableNode: () => null,
    getScrollResponder: () => null!,
    getState: () => state,
    reportContentInset() {},
    scrollIndexIntoView: async () => {},
    scrollItemIntoView: async () => {},
    scrollToEnd: async () => {},
    scrollToIndex: async () => {},
    scrollToItem: async () => {},
    scrollToOffset: async () => {},
    setItemSize() {},
    setScrollProcessingEnabled() {},
    setVisibleContentAnchorOffset() {},
};
const component: LegendListComponent = LegendList;
const webComponent: WebComponent = Web;
declare const nativeProps: LegendListProps<any>;
declare const webProps: WebProps<any>;
const componentProps: React.ComponentProps<typeof LegendList> = nativeProps;
const roundTripProps: LegendListProps<any> = componentProps;
const webComponentProps: React.ComponentProps<typeof Web> = webProps;
const webRoundTripProps: WebProps<any> = webComponentProps;
const sectionProps: Omit<SectionListProps<Item>, "keyExtractor"> = {
    renderItem: ({ item }) => {
        // @ts-expect-error Section wrappers retain contextual typing.
        item.unknown;
        const id: string = item.id;
        void id;
        return null;
    },
    sections: [{ data: [{ id: "a" }] }],
};
const section = <SectionList {...sectionProps} />;

void [
    nativeWrapper,
    webWrapper,
    animatedBase,
    animated,
    keyboard,
    keyboardLegacy,
    mockRef,
    component,
    webComponent,
    roundTripProps,
    webRoundTripProps,
    section,
];
