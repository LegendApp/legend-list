import { type ReactElement, useEffect } from "react";

import { getDataLength } from "@/core/IndexedData";
import { Platform } from "@/platform/Platform";
import type { LooseScrollViewProps } from "@/platform/scrollview-types";
import { listen$, peek$, useStateContext } from "@/state/state";
import { IS_DEV } from "@/utils/devEnvironment";
import { warnDevOnce } from "@/utils/helpers";

const WEB_UNBOUNDED_HEIGHT_MIN_DATA_LENGTH = 100;
const WEB_UNBOUNDED_HEIGHT_CONTAINER_RATIO = 0.9;
const WEB_UNBOUNDED_HEIGHT_VIEWPORT_RATIO = 0.9;

type LegendListDevProps = {
    anchoredEndSpace?: unknown;
    numColumns?: number;
    scrollElement?: HTMLElement | null;
    childrenMode?: boolean;
    keyExtractor?: unknown;
    renderScrollComponent?: ((props: LooseScrollViewProps) => ReactElement | null) | undefined;
    useWindowScroll?: boolean | undefined;
};

function useDevChecksImpl(props: LegendListDevProps) {
    const ctx = useStateContext();
    const {
        anchoredEndSpace,
        childrenMode,
        keyExtractor,
        numColumns,
        renderScrollComponent,
        scrollElement,
        useWindowScroll,
    } = props;
    const hasAnchoredEndSpace = !!anchoredEndSpace;
    const shouldWarnAboutIndexKeys =
        !keyExtractor && !ctx.state.props.dataSource && !ctx.state.isFirst && ctx.state.didDataChange && !childrenMode;

    useEffect(() => {
        if (hasAnchoredEndSpace && (numColumns ?? 1) > 1) {
            warnDevOnce(
                "anchoredEndSpaceNumColumns",
                "anchoredEndSpace is only supported when numColumns is 1. Using it with multiple columns may produce incorrect anchored spacing.",
            );
        }
    }, [hasAnchoredEndSpace, numColumns]);

    useEffect(() => {
        if ((useWindowScroll || scrollElement !== undefined) && renderScrollComponent) {
            warnDevOnce(
                "useWindowScrollRenderScrollComponent",
                "useWindowScroll and scrollElement are not supported when renderScrollComponent is provided.",
            );
        }
    }, [renderScrollComponent, scrollElement, useWindowScroll]);

    useEffect(() => {
        if (shouldWarnAboutIndexKeys) {
            warnDevOnce(
                "keyExtractor",
                "Without a keyExtractor, measured sizes stay with their index. Appends keep layout, but inserts, removals, and reorders move content to rows with the wrong size. Pass a keyExtractor that returns a stable unique id.",
            );
        }
    }, [shouldWarnAboutIndexKeys]);

    useEffect(() => {
        const state = ctx.state;
        const dataLength = getDataLength(state);
        const usesExternalScroll = state.props.hasExternalScroll;

        if (Platform.OS !== "web" || usesExternalScroll || dataLength < WEB_UNBOUNDED_HEIGHT_MIN_DATA_LENGTH) {
            return;
        }

        const warnIfUnboundedOuterSize = () => {
            const readyToRender = peek$(ctx, "readyToRender");
            const numContainers = peek$(ctx, "numContainers") || 0;
            const totalSize = peek$(ctx, "totalSize") || 0;
            const scrollLength = ctx.state.scrollLength || 0;

            if (!readyToRender || totalSize <= 0 || scrollLength <= 0) {
                return;
            }

            const rendersAlmostEverything =
                numContainers >= Math.ceil(dataLength * WEB_UNBOUNDED_HEIGHT_CONTAINER_RATIO);
            const viewportMatchesContent = scrollLength >= totalSize * WEB_UNBOUNDED_HEIGHT_VIEWPORT_RATIO;

            if (rendersAlmostEverything && viewportMatchesContent) {
                warnDevOnce(
                    "webUnboundedOuterSize",
                    "LegendList appears to have an unbounded outer height on web, so virtualization is effectively disabled. Set a bounded height or flex: 1 on the list container, or use useWindowScroll.",
                );
            }
        };

        warnIfUnboundedOuterSize();

        const unsubscribe = [
            listen$(ctx, "numContainers", warnIfUnboundedOuterSize),
            listen$(ctx, "readyToRender", warnIfUnboundedOuterSize),
            listen$(ctx, "totalSize", warnIfUnboundedOuterSize),
        ];

        return () => {
            for (const unsub of unsubscribe) {
                unsub();
            }
        };
    }, [ctx]);
}

function useDevChecksNoop(_props: LegendListDevProps) {}

export const useDevChecks = IS_DEV ? useDevChecksImpl : useDevChecksNoop;
