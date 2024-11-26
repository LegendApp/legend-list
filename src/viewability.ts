import { peek$ } from './state';
import { getId } from './LegendListHelpers';
import type {
    InternalState,
    ViewToken,
    ViewabilityConfig,
    ViewabilityConfigCallbackPair,
    ViewabilityConfigCallbackPairs,
} from './types';

const mapViewabilityConfigCallbackPairs = new WeakMap<
    ViewabilityConfigCallbackPair,
    {
        viewableItems: ViewToken[];
        start: number;
        end: number;
        previousStart: number;
        previousEnd: number;
    }
>();
export function setupViewability(state: InternalState) {
    let {
        props: { viewabilityConfig, viewabilityConfigCallbackPairs, onViewableItemsChanged },
    } = state;

    viewabilityConfigCallbackPairs =
        viewabilityConfigCallbackPairs! ||
        (onViewableItemsChanged && [
            { viewabilityConfig: viewabilityConfig || { viewAreaCoveragePercentThreshold: 0 }, onViewableItemsChanged },
        ]);

    if (viewabilityConfigCallbackPairs) {
        viewabilityConfigCallbackPairs.forEach((pair) => {
            mapViewabilityConfigCallbackPairs.set(pair, {
                viewableItems: [],
                start: -1,
                end: -1,
                previousStart: -1,
                previousEnd: -1,
            });
        });
        state.updateViewableItems = updateViewableItems.bind(undefined, state, viewabilityConfigCallbackPairs);
    }
}

function updateViewableItems(
    state: InternalState,
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPairs,
    start: number,
    end: number,
) {
    viewabilityConfigCallbackPairs.forEach((viewabilityConfigCallbackPair) => {
        const viewabilityState = mapViewabilityConfigCallbackPairs.get(viewabilityConfigCallbackPair)!;
        viewabilityState.start = start;
        viewabilityState.end = end;
        if (viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime) {
            const timer = setTimeout(() => {
                state.timeouts.delete(timer);
                updateViewableItemsWithConfig(state, viewabilityConfigCallbackPair);
            }, viewabilityConfigCallbackPair.viewabilityConfig.minimumViewTime);
            state.timeouts.add(timer);
        } else {
            updateViewableItemsWithConfig(state, viewabilityConfigCallbackPair);
        }
    });
}

function updateViewableItemsWithConfig(
    state: InternalState,
    viewabilityConfigCallbackPair: ViewabilityConfigCallbackPair,
) {
    const viewabilityState = mapViewabilityConfigCallbackPairs.get(viewabilityConfigCallbackPair)!;
    const { viewableItems: previousViewableItems, start, previousStart, end, previousEnd } = viewabilityState;
    // if (previousStart === start && previousEnd === end) {
    //     // Already processed this, so skip it
    //     return;
    // }
    const changed: ViewToken[] = [];
    if (previousViewableItems) {
        previousViewableItems.forEach((viewToken) => {
            if (viewToken.index! < start || viewToken.index! > end) {
                viewToken.isViewable = false;
                changed.push(viewToken);
            }
        });
    }

    const {
        props: { data },
    } = state;

    const viewableItems: ViewToken[] = [];

    for (let i = start; i <= end; i++) {
        const item = data[i];
        if (item) {
            const key = getId(state, i);
            if (isViewable(state, viewabilityConfigCallbackPair.viewabilityConfig, key)) {
                const viewToken: ViewToken = {
                    item,
                    key,
                    index: i,
                    isViewable: true,
                };

                viewableItems.push(viewToken);
                if (!previousViewableItems?.find((v) => v.key === viewToken.key)) {
                    changed.push(viewToken);
                }
            }
        }
    }

    Object.assign(viewabilityState, { viewableItems, previousStart: start, previousEnd: end });

    if (changed.length > 0) {
        viewabilityConfigCallbackPair.onViewableItemsChanged?.({ viewableItems, changed });
    }
}

function isViewable(state: InternalState, viewabilityConfig: ViewabilityConfig, key: string) {
    const { sizes, positions, scroll, scrollSize, ctx } = state;
    const topPad = (peek$(ctx, `stylePaddingTop`) || 0) + (peek$(ctx, `headerSize`) || 0);
    const { itemVisiblePercentThreshold, viewAreaCoveragePercentThreshold } = viewabilityConfig;
    const viewAreaMode = viewAreaCoveragePercentThreshold != null;
    const viewablePercentThreshold = viewAreaMode ? viewAreaCoveragePercentThreshold : itemVisiblePercentThreshold;
    const top = positions.get(key)! - scroll + topPad;
    const size = sizes.get(key)! || 0;
    const bottom = top + size;
    const isEntirelyVisible = top >= 0 && bottom <= scrollSize && bottom > top;

    if (isEntirelyVisible) {
        return true;
    } else {
        const visibleHeight = Math.min(bottom, scrollSize) - Math.max(top, 0);
        const percent = 100 * (visibleHeight / (viewAreaMode ? scrollSize : size));
        return percent >= viewablePercentThreshold!;
    }
}
