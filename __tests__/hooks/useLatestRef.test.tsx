import * as React from "react";

import { describe, expect, it } from "bun:test";
import { useLatestRef } from "../../src/hooks/useLatestRef";
import TestRenderer, { act } from "../helpers/testRenderer";
import "../setup";

function Probe({ onRef, value }: { onRef: (ref: React.RefObject<string>) => void; value: string }) {
    const ref = useLatestRef(value);

    React.useEffect(() => {
        onRef(ref);
    });

    return null;
}

describe("useLatestRef", () => {
    it("keeps a stable ref updated with the latest value", () => {
        const refs: React.RefObject<string>[] = [];
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(
                <Probe
                    onRef={(ref) => {
                        refs.push(ref);
                    }}
                    value="first"
                />,
            );
        });

        expect(refs).toHaveLength(1);
        expect(refs[0].current).toBe("first");

        act(() => {
            renderer.update(
                <Probe
                    onRef={(ref) => {
                        refs.push(ref);
                    }}
                    value="second"
                />,
            );
        });

        expect(refs).toHaveLength(2);
        expect(refs[1]).toBe(refs[0]);
        expect(refs[0].current).toBe("second");

        act(() => {
            renderer.unmount();
        });
    });
});
