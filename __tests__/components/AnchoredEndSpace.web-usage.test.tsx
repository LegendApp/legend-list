import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";

import TestRenderer, { act } from "../helpers/testRenderer";

let lastLegendListProps: any;

mock.module("@legendapp/list/react", () => ({
    LegendList: React.forwardRef(function LegendListMock(props: any, _ref) {
        lastLegendListProps = props;
        return null;
    }),
}));

function WebChatHarness() {
    const [messages, setMessages] = React.useState([{ id: "0", text: "hello" }]);
    const [anchorIndex, setAnchorIndex] = React.useState<number | undefined>(undefined);

    const sendMessage = React.useCallback(() => {
        setAnchorIndex(messages.length);
        setMessages((prev) => [...prev, { id: String(prev.length), text: "next" }]);
    }, [messages.length]);

    const { LegendList } = require("@legendapp/list/react") as typeof import("@legendapp/list/react");

    return (
        <>
            <LegendList
                anchoredEndSpace={anchorIndex !== undefined ? { anchorIndex } : undefined}
                data={messages}
                estimatedItemSize={40}
                keyExtractor={(item: { id: string }) => item.id}
                renderItem={() => null}
            />
            <button onClick={sendMessage} type="button" />
        </>
    );
}

describe("anchoredEndSpace web usage", () => {
    beforeEach(() => {
        lastLegendListProps = undefined;
    });

    it("updates the web usage pattern to pass anchoredEndSpace after sending", () => {
        let renderer: ReturnType<typeof TestRenderer.create>;

        act(() => {
            renderer = TestRenderer.create(<WebChatHarness />);
        });

        expect(lastLegendListProps.anchoredEndSpace).toBeUndefined();

        const button = renderer!.root.findByType("button");

        act(() => {
            button.props.onClick();
        });

        expect(lastLegendListProps.anchoredEndSpace).toEqual({ anchorIndex: 1 });
    });
});
