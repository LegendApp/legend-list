import { peek$, type StateContext, set$ } from "@/state/state";

// Separators render with both the leading and the trailing item, so a container has to update when
// the *next* item changes even though its own item did not. The signal is only published for lists
// with an ItemSeparatorComponent so other lists pay nothing for it.
export function updateContainerTrailingItem(ctx: StateContext, containerIndex: number, itemIndex: number) {
    const state = ctx.state;
    const {
        props: { data, hasItemSeparator, itemsAreEqual, keyExtractor },
    } = state;

    if (!hasItemSeparator) {
        return;
    }

    const key = `containerItemTrailingData${containerIndex}` as const;
    const trailingIndex = itemIndex + 1;
    const trailingItem = data[trailingIndex];
    const prevTrailingItem = peek$(ctx, key);

    if (prevTrailingItem === trailingItem) {
        return;
    }

    if (itemsAreEqual && keyExtractor && prevTrailingItem !== undefined && trailingItem !== undefined) {
        const isEqual =
            keyExtractor(prevTrailingItem, trailingIndex) === keyExtractor(trailingItem, trailingIndex) &&
            itemsAreEqual(prevTrailingItem, trailingItem, trailingIndex, data);

        if (isEqual) {
            return;
        }
    }

    set$(ctx, key, trailingItem);
}

export function clearContainerTrailingItem(ctx: StateContext, containerIndex: number) {
    if (ctx.state.props.hasItemSeparator) {
        set$(ctx, `containerItemTrailingData${containerIndex}`, undefined);
    }
}
