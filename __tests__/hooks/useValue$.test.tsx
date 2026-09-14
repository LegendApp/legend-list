import { describe, expect, it, spyOn } from "bun:test";
import "../setup";

import * as React from "react";
import { Animated } from "react-native";

import { useValue$ } from "../../src/hooks/useValue$";
import { type ListenerType, type StateContext, StateProvider, set$, useStateContext } from "../../src/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";

function mountProbe({
    getValue,
    duringLayout,
    strict = false,
}: {
    getValue?: (value: number) => number;
    duringLayout?: (ctx: StateContext) => void;
    strict?: boolean;
} = {}) {
    let ctx: StateContext;
    const setValue = spyOn(Animated.Value.prototype, "setValue");

    function Child() {
        const childCtx = useStateContext();
        React.useLayoutEffect(() => duringLayout?.(childCtx), [childCtx]);
        return null;
    }

    function Probe({ signal }: { signal: ListenerType }) {
        ctx = useStateContext();
        useValue$(signal, { getValue });
        return <Child />;
    }

    function tree(signal: ListenerType) {
        const content = (
            <StateProvider>
                <Probe signal={signal} />
            </StateProvider>
        );
        return strict ? <React.StrictMode>{content}</React.StrictMode> : content;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
        renderer = TestRenderer.create(tree("totalSize"));
    });
    return {
        ctx: ctx!,
        setValue,
        unmount() {
            act(() => renderer.unmount());
        },
        update(signal: ListenerType) {
            act(() => renderer.update(tree(signal)));
        },
    };
}

describe("useValue$", () => {
    it.each([false, true])("does not rewrite an unchanged initial value (strict: %s)", (strict) => {
        const probe = mountProbe({ strict });
        try {
            expect(probe.setValue).not.toHaveBeenCalled();
            probe.update("totalSize");
            expect(probe.setValue).not.toHaveBeenCalled();
            expect(probe.ctx.listeners.get("totalSize")?.size).toBe(1);
        } finally {
            probe.unmount();
        }
        expect(probe.ctx.listeners.get("totalSize")?.size).toBe(0);
    });

    it("resyncs changes between render and subscription", () => {
        const probe = mountProbe({ duringLayout: (ctx) => set$(ctx, "totalSize", 125) });
        try {
            expect(probe.setValue.mock.calls).toEqual([[125]]);
        } finally {
            probe.unmount();
        }
    });

    it("skips equal mapped values while forwarding changes synchronously", () => {
        const probe = mountProbe({ getValue: (value) => Math.floor(value / 100) });
        try {
            set$(probe.ctx, "totalSize", 50);
            expect(probe.setValue).not.toHaveBeenCalled();
            set$(probe.ctx, "totalSize", 150);
            set$(probe.ctx, "totalSize", 175);
            set$(probe.ctx, "totalSize", 250);
            expect(probe.setValue.mock.calls).toEqual([[1], [2]]);
        } finally {
            probe.unmount();
        }
    });

    it("resyncs a new key and stops listening to the previous key", () => {
        const probe = mountProbe();
        try {
            set$(probe.ctx, "headerSize", 80);
            probe.update("headerSize");
            set$(probe.ctx, "totalSize", 200);
            set$(probe.ctx, "headerSize", 90);
            expect(probe.setValue.mock.calls).toEqual([[80], [90]]);
            expect(probe.ctx.listeners.get("totalSize")?.size).toBe(0);
        } finally {
            probe.unmount();
        }
    });
});
