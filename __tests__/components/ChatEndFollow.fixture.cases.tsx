import * as React from "react";
import * as JSXDevRuntime from "react/jsx-dev-runtime";
import * as JSXRuntime from "react/jsx-runtime";

import { afterEach, beforeEach, expect, it, mock } from "bun:test";
import TestRenderer, { act } from "../helpers/testRenderer";

type Message = { id: string; typing?: boolean };
let messages: Message[];
let renderer: TestRenderer.ReactTestRenderer | undefined;
const originalLocation = window.location;

mock.module("../../example-web/node_modules/react/index.js", () => React);
mock.module("../../example-web/node_modules/react/jsx-dev-runtime.js", () => JSXDevRuntime);
mock.module("../../example-web/node_modules/react/jsx-runtime.js", () => JSXRuntime);

beforeEach(() => {
    mock.module("@legendapp/list/react", () => ({
        LegendList: (props: { data: Message[] }) => {
            messages = props.data;
            return null;
        },
    }));
});

afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    window.location = originalLocation;
});

for (const footer of [false, true]) {
    it(`keeps typing idempotent and responses unique across chats (footer: ${footer})`, async () => {
        window.location = { search: `?count=4&footer=${footer}` } as Location;
        const { default: Fixture } = await import("../../example-web/src/fixtures/ChatEndFollowExample");
        act(() => {
            renderer = TestRenderer.create(<Fixture />);
        });

        const click = (label: string, times = 1) => {
            act(() => {
                for (let i = 0; i < times; i++) {
                    renderer!.root
                        .findAllByType("button")
                        .find((button) => button.props.children === label)!
                        .props.onClick();
                }
            });
            expect(new Set(messages.map((item) => item.id)).size).toBe(messages.length);
        };

        for (let chat = 0; chat < 3; chat++) {
            const initialCount = messages.length;
            click("Typing", 3);
            expect(messages.filter((item) => item.typing)).toHaveLength(footer ? 0 : 1);
            click("Respond", 3);
            expect(messages.filter((item) => item.typing)).toHaveLength(0);
            expect(messages).toHaveLength(initialCount + 3);
            click("Typing");
            click("Respond");
            expect(messages).toHaveLength(initialCount + 4);
            click("Switch chat");
        }
    });
}
