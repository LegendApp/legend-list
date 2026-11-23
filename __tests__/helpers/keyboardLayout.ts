import { batchItemSizeUpdates } from "../../src/core/updateItemSizes";
import { peek$, type StateContext } from "../../src/state/state";
import { act, type ReactTestRenderer } from "./testRenderer";

export const layoutEvent = (width: number, height: number) => ({
    nativeEvent: { layout: { height, width, x: 0, y: 0 } },
});

export function measureMountedRows(
    renderer: ReactTestRenderer,
    list: StateContext,
    sizes: ReadonlyMap<string, number>,
    width: number,
) {
    act(() => {
        const views = renderer.root.findAll(
            (node) => typeof node.type !== "string" && typeof node.props.id === "number" && !!node.props.refView,
        );
        batchItemSizeUpdates(() => {
            for (const view of views) {
                const key = peek$(list, `containerItemKey${view.props.id}`);
                const size = key === undefined ? undefined : sizes.get(key);
                if (size !== undefined) view.props.onLayout?.(layoutEvent(width, size));
            }
        });
    });
}

export function measureFooter(renderer: ReactTestRenderer, width: number, height: number) {
    const footerLayout = renderer.root.find(
        (node) =>
            typeof node.type === "string" &&
            node.children.some((child) => typeof child !== "string" && child.props.testID === "footer"),
    );
    act(() => footerLayout.props.onLayout(layoutEvent(width, height)));
}
