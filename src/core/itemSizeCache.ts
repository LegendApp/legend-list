import { peek$, type StateContext } from "@/state/state";
import { getId } from "@/utils/getId";

interface CachedItemSize {
    crossAxisSize: number | undefined;
    index: number;
    inputs: unknown[];
    isLast: boolean;
    item: unknown;
    size: number;
}

// Extractors can live for the application's lifetime; bound retained estimates per owner.
const MAX_CACHED_ITEM_SIZES = 1000;
const itemSizesByOwner = new WeakMap<object, Map<string, CachedItemSize>>();
const itemSizesByContext = new WeakMap<StateContext, Map<string, CachedItemSize>>();

function getInputs(ctx: StateContext) {
    const { props } = ctx.state;
    return [
        props.dataKey,
        props.dataVersion,
        props.horizontal,
        props.numColumns,
        props.renderItem,
        props.getItemType,
        props.overrideItemLayout,
        peek$(ctx, "extraData"),
        ctx.scrollAxisGap,
        props.stylePaddingTop,
        props.stylePaddingBottom,
        props.stylePaddingLeft,
        props.stylePaddingRight,
    ];
}

export function restoreItemSizeEstimates(ctx: StateContext, crossAxisSize: number | undefined, owner?: object) {
    // Grid wrapping depends on cross-axis spacing; retain those measurements only within an instance.
    if (owner === undefined || ctx.state.props.numColumns > 1) return;
    const cached = itemSizesByOwner.get(owner) ?? itemSizesByOwner.get(ctx.state.props.data);
    if (!cached) return;
    itemSizesByContext.set(ctx, cached);
    // Bind rebuilt arrays too, so a full clear invalidates every alias of this snapshot.
    itemSizesByOwner.set(ctx.state.props.data, cached);
    // Unknown viewport dimensions cannot establish that a previous layout is compatible.
    if (crossAxisSize === undefined) return;
    const inputs = getInputs(ctx);
    const { state } = ctx;
    // Data can arrive after mount or replace a loading placeholder.
    for (const [key, entry] of cached) {
        // Estimates never count as measurements: every mounted row still measures before reveal.
        if (
            !state.sizesKnown.has(key) &&
            entry.crossAxisSize === crossAxisSize &&
            state.props.data[entry.index] === entry.item &&
            entry.isLast === (entry.index === state.props.data.length - 1) &&
            getId(state, entry.index) === key &&
            inputs.every((input, i) => Object.is(input, entry.inputs[i]))
        ) {
            state.sizes.set(key, entry.size);
        }
    }
}

export function clearItemSizeEstimates(ctx: StateContext) {
    (itemSizesByContext.get(ctx) ?? itemSizesByOwner.get(ctx.state.props.data))?.clear();
}

export function saveItemSizeEstimates(ctx: StateContext, owner?: object) {
    const { state } = ctx;
    if (owner === undefined || state.props.numColumns > 1 || !state.sizesKnown.size) return;
    let cached = itemSizesByOwner.get(owner) ?? itemSizesByOwner.get(state.props.data);
    if (!cached) {
        cached = new Map();
    }
    itemSizesByOwner.set(owner, cached);
    itemSizesByOwner.set(state.props.data, cached);
    itemSizesByContext.set(ctx, cached);
    const crossAxisSize = state.lastLayout?.[state.props.horizontal ? "height" : "width"];
    const inputs = getInputs(ctx);
    for (const [key, size] of state.sizesKnown) {
        const index = state.indexByKey.get(key);
        if (index !== undefined && !state.fixedItemSizeKeys?.has(key)) {
            cached.delete(key);
            cached.set(key, {
                crossAxisSize,
                index,
                inputs,
                isLast: index === state.props.data.length - 1,
                item: state.props.data[index],
                size,
            });
        }
    }
    while (cached.size > MAX_CACHED_ITEM_SIZES) cached.delete(cached.keys().next().value!);
}
