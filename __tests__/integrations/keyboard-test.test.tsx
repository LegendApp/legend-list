import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastAnimatedLegendListProps: any;
const reportContentInsetMock = mock((_insets: { bottom: number; left: number; right: number; top: number }) => {});

const createSharedValue = <T,>(initial: T) => ({
    value: initial,
});

mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: (props: any) => React.createElement("keyboard-chat-scroll-view", props),
    KeyboardController: {
        dismiss: () => Promise.resolve(),
    },
}));

mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: React.forwardRef(function AnimatedLegendListMock(props: any, ref) {
        lastAnimatedLegendListProps = props;
        React.useImperativeHandle(
            ref,
            () => ({
                getState: () => ({
                    contentLength: 0,
                    scroll: 0,
                    scrollLength: 0,
                }),
                reportContentInset: reportContentInsetMock,
                setScrollProcessingEnabled: () => {},
            }),
            [],
        );
        return null;
    }),
}));

const baseProps = {
    data: [{ id: "1" }],
    estimatedItemSize: 10,
    keyExtractor: (item: { id: string }) => item.id,
    renderItem: () => null,
};

const renderKeyboardTestLegendList = async (props: Record<string, unknown> = {}) => {
    const { KeyboardAvoidingLegendList } = await import("../../src/integrations/keyboard-test");

    act(() => {
        TestRenderer.create(<KeyboardAvoidingLegendList {...baseProps} {...props} />);
    });
};

describe("KeyboardAvoidingLegendList keyboard-test integration", () => {
    beforeEach(() => {
        lastAnimatedLegendListProps = undefined;
        reportContentInsetMock.mockClear();
    });

    it("reports KeyboardChatScrollView content inset changes to LegendList", async () => {
        await renderKeyboardTestLegendList();

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});
        const insets = { bottom: 32, left: 0, right: 0, top: 0 };

        scrollElement.props.onContentInsetChange(insets);

        expect(reportContentInsetMock).toHaveBeenCalledWith(insets);
        expect(lastAnimatedLegendListProps.onContentInsetChange).toBeUndefined();
    });

    it("adapts contentInsetEndAdjustment into KeyboardChatScrollView extraContentPadding", async () => {
        await renderKeyboardTestLegendList({ contentInsetEndAdjustment: createSharedValue(28) });

        const scrollElement = lastAnimatedLegendListProps.renderScrollComponent({});

        expect(scrollElement.props.extraContentPadding.value).toBe(28);
        expect(lastAnimatedLegendListProps.contentInsetEndAdjustment).toBeUndefined();
    });
});
