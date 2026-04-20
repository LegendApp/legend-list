import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../setup";

import TestRenderer, { act } from "../helpers/testRenderer";

const setValue = mock((value: number) => {
    animatedValue.value = value;
});
const animatedValue = {
    getValue: () => animatedValue.value,
    setValue,
    value: 0,
};

let peekCalls = 0;
const mockCtx = {
    listeners: new Map(),
    values: new Map(),
};

function registerUseValueMocks() {
    mock.module("@/hooks/useAnimatedValue", () => ({
        useAnimatedValue: () => animatedValue,
    }));

    mock.module("@/state/state", () => ({
        listen$: () => () => {},
        peek$: () => (peekCalls++ === 0 ? false : true),
        useStateContext: () => mockCtx,
    }));
}

function resetMocks() {
    animatedValue.value = 0;
    peekCalls = 0;
    setValue.mockClear();
}

describe("useValue$", () => {
    beforeEach(() => {
        registerUseValueMocks();
        resetMocks();
    });

    it("resyncs the current value on mount after subscribing", async () => {
        const { useValue$ } = await import("../../src/hooks/useValue$?mount-resync");

        function Probe() {
            useValue$("readyToRender", {
                getValue: (value) => (value ? 1 : 0),
            });
            return null;
        }

        let renderer: TestRenderer.ReactTestRenderer | undefined;
        try {
            act(() => {
                renderer = TestRenderer.create(<Probe />);
            });

            expect(setValue).toHaveBeenCalledWith(1);
            expect(animatedValue.getValue()).toBe(1);
        } finally {
            act(() => {
                renderer?.unmount();
            });
        }
    });
});
