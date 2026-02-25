import type React from "react";

import act from "@testing-library/react-native/build/act";
import { renderWithAct } from "@testing-library/react-native/build/render-act";

type RenderResult = {
    rerender: (component: React.ReactElement) => void;
    unmount: () => void;
    toJSON: () => any;
};

export function render(component: React.ReactElement): RenderResult {
    const renderer = renderWithAct(component, {});
    return {
        rerender: (nextComponent: React.ReactElement) => {
            act(() => {
                renderer.update(nextComponent);
            });
        },
        toJSON: () => renderer.toJSON(),
        unmount: () => {
            act(() => {
                renderer.unmount();
            });
        },
    };
}

export { act };
