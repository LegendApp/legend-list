import { describe, expect, it } from "bun:test";
import "../setup";

import * as React from "react";

import { SnapWrapper } from "@/components/SnapWrapper";
import { StateProvider, useStateContext } from "@/state/state";
import TestRenderer, { act } from "../helpers/testRenderer";

function Setup({ children }: { children: React.ReactNode }) {
    const ctx = useStateContext();
    ctx.values.set("snapToOffsets", [0, 120, 240]);
    return children;
}

describe("SnapWrapper", () => {
    it("forwards the scroll ref while passing computed snap offsets", () => {
        const receivedProps: any[] = [];
        const receivedRefs: React.Ref<any>[] = [];
        const ref = React.createRef<HTMLDivElement>();
        const ScrollComponent = React.forwardRef(function ScrollComponentMock(
            props: any,
            forwardedRef: React.Ref<any>,
        ) {
            receivedProps.push(props);
            receivedRefs.push(forwardedRef);
            return null;
        });

        act(() => {
            TestRenderer.create(
                <StateProvider>
                    <Setup>
                        <SnapWrapper onLayout={() => {}} ref={ref} ScrollComponent={ScrollComponent} style={{}} />
                    </Setup>
                </StateProvider>,
            );
        });

        expect(receivedRefs.at(-1)).toBe(ref);
        expect(receivedProps.at(-1)?.snapToOffsets).toEqual([0, 120, 240]);
    });
});
