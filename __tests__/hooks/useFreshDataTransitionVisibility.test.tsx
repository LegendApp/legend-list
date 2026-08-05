import { Text } from "react-native";

import { describe, expect, it } from "bun:test";
import { useFreshDataTransitionVisibility } from "../../src/hooks/useFreshDataTransitionVisibility";
import TestRenderer, { act } from "../helpers/testRenderer";
import "../setup";

function VisibilityProbe({ readyToRender, transitionEpoch }: { readyToRender: boolean; transitionEpoch: number }) {
    const isVisible = useFreshDataTransitionVisibility(readyToRender, transitionEpoch);
    return <Text>{isVisible ? "visible" : "hidden"}</Text>;
}

describe("useFreshDataTransitionVisibility", () => {
    it("hides a fresh dataset until the readiness reset has been observed", () => {
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<VisibilityProbe readyToRender transitionEpoch={0} />);
        });
        expect(renderer.root.findByType(Text).props.children).toBe("visible");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender transitionEpoch={1} />);
        });
        expect(renderer.root.findByType(Text).props.children).toBe("hidden");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender={false} transitionEpoch={1} />);
        });
        expect(renderer.root.findByType(Text).props.children).toBe("hidden");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender transitionEpoch={1} />);
        });
        expect(renderer.root.findByType(Text).props.children).toBe("visible");

        act(() => {
            renderer.unmount();
        });
    });
});
