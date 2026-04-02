import type React from "react";

import act from "@testing-library/react-native/build/act";
import { renderWithAct } from "@testing-library/react-native/build/render-act";

type RenderResult = {
    rerender: (component: React.ReactElement) => void;
    unmount: () => void;
    toJSON: () => any;
};

const mountedRenderers = new Set<{ unmount: () => void; update: (component: React.ReactElement) => void; toJSON: () => any }>();

export function cleanupRenders() {
    for (const renderer of mountedRenderers) {
        act(() => {
            renderer.unmount();
        });
    }
    mountedRenderers.clear();
}

export function render(component: React.ReactElement): RenderResult {
    const renderer = renderWithAct(component, {});
    mountedRenderers.add(renderer);
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
            mountedRenderers.delete(renderer);
        },
    };
}

export { act };
