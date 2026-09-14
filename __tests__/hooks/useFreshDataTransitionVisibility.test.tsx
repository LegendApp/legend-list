import { Text } from "react-native";

import { describe, expect, it } from "bun:test";
import { useFreshDataTransitionVisibility } from "../../src/hooks/useFreshDataTransitionVisibility";
import TestRenderer, { act } from "../helpers/testRenderer";
import "../setup";

function VisibilityProbe({ readyToRender, transitionEpoch }: { readyToRender: boolean; transitionEpoch: number }) {
    const isVisible = useFreshDataTransitionVisibility(readyToRender, transitionEpoch);
    return <Text>{isVisible ? "visible" : "hidden"}</Text>;
}

function visibility(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findByType(Text).props.children;
}

describe("useFreshDataTransitionVisibility", () => {
    it("hides a fresh dataset until the readiness reset has been observed", () => {
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<VisibilityProbe readyToRender transitionEpoch={0} />);
        });
        expect(visibility(renderer)).toBe("visible");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender={false} transitionEpoch={1} />);
        });
        expect(visibility(renderer)).toBe("hidden");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender transitionEpoch={1} />);
        });
        expect(visibility(renderer)).toBe("visible");

        act(() => {
            renderer.unmount();
        });
    });

    it("reveals a fresh dataset even when the readiness reset is never rendered", () => {
        // The reset of readyToRender and the layout that restores it can both land in the same
        // layout-effect pass, so the not-ready state never reaches a render. Waiting for it left
        // the content hidden permanently with the list fully measured behind it.
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<VisibilityProbe readyToRender transitionEpoch={0} />);
        });
        expect(visibility(renderer)).toBe("visible");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender transitionEpoch={1} />);
        });
        expect(visibility(renderer)).toBe("visible");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender transitionEpoch={2} />);
        });
        expect(visibility(renderer)).toBe("visible");

        act(() => {
            renderer.unmount();
        });
    });

    it("stays hidden while the list is not ready", () => {
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(<VisibilityProbe readyToRender={false} transitionEpoch={0} />);
        });
        expect(visibility(renderer)).toBe("hidden");

        act(() => {
            renderer.update(<VisibilityProbe readyToRender={false} transitionEpoch={1} />);
        });
        expect(visibility(renderer)).toBe("hidden");

        act(() => {
            renderer.unmount();
        });
    });
});
