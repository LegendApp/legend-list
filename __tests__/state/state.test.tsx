import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import * as React from "react";
import { Text } from "react-native";

import { render } from "../helpers/testingLibrary";

type SyncExternalStoreCall = {
    getServerSnapshot: (() => unknown) | undefined;
    getSnapshot: () => unknown;
    subscribe: (cb: () => void) => () => void;
};

const syncExternalStoreCalls: SyncExternalStoreCall[] = [];

describe("state SSR snapshots", () => {
    beforeEach(() => {
        syncExternalStoreCalls.length = 0;

        mock.module("use-sync-external-store/shim", () => ({
            useSyncExternalStore: (
                subscribe: (cb: () => void) => () => void,
                getSnapshot: () => unknown,
                getServerSnapshot?: () => unknown,
            ) => {
                syncExternalStoreCalls.push({ getServerSnapshot, getSnapshot, subscribe });
                return getSnapshot();
            },
        }));
    });

    it("provides getServerSnapshot for useArr$", async () => {
        const { StateProvider, useArr$ } = await import("../../src/state/state?state-ssr-use-arr");

        const observed: number[] = [];

        function TestComponent() {
            const [headerSize] = useArr$(["headerSize"]);
            observed.push(headerSize);
            return <Text>{String(headerSize)}</Text>;
        }

        const rendered = render(
            <StateProvider>
                <TestComponent />
            </StateProvider>,
        );

        expect(syncExternalStoreCalls).toHaveLength(1);
        expect(typeof syncExternalStoreCalls[0].getServerSnapshot).toBe("function");
        expect(syncExternalStoreCalls[0].getServerSnapshot?.()).toEqual(syncExternalStoreCalls[0].getSnapshot());
        expect(observed.at(-1)).toBe(0);

        rendered.unmount();
    });

    it("provides getServerSnapshot for useSelector$", async () => {
        const { StateProvider, useSelector$ } = await import("../../src/state/state?state-ssr-use-selector");

        const observed: number[] = [];

        function TestComponent() {
            const doubledHeaderSize = useSelector$("headerSize", (value) => value * 2);
            observed.push(doubledHeaderSize);
            return <Text>{String(doubledHeaderSize)}</Text>;
        }

        const rendered = render(
            <StateProvider>
                <TestComponent />
            </StateProvider>,
        );

        expect(syncExternalStoreCalls).toHaveLength(1);
        expect(typeof syncExternalStoreCalls[0].getServerSnapshot).toBe("function");
        expect(syncExternalStoreCalls[0].getServerSnapshot?.()).toEqual(syncExternalStoreCalls[0].getSnapshot());
        expect(observed.at(-1)).toBe(0);

        rendered.unmount();
    });
});
