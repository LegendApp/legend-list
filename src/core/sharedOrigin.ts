import { Platform } from "@/platform/Platform";
import type { InternalState } from "@/types.base";

type SharedOriginPlatformPolicy = {
    allowDeferredVisualAdjust: boolean;
    enabled: boolean;
};

const SHARED_ORIGIN_PLATFORM_POLICY: Record<string, SharedOriginPlatformPolicy> = {
    android: {
        allowDeferredVisualAdjust: false,
        enabled: true,
    },
    ios: {
        allowDeferredVisualAdjust: false,
        enabled: true,
    },
    web: {
        allowDeferredVisualAdjust: true,
        enabled: true,
    },
};

const DEFAULT_SHARED_ORIGIN_PLATFORM_POLICY: SharedOriginPlatformPolicy = {
    allowDeferredVisualAdjust: false,
    enabled: false,
};

export function getSharedOriginPlatformPolicy(platform = Platform.OS): SharedOriginPlatformPolicy {
    return SHARED_ORIGIN_PLATFORM_POLICY[platform] ?? DEFAULT_SHARED_ORIGIN_PLATFORM_POLICY;
}

export function canUseSharedContainerOrigin(state: InternalState, numColumns: number) {
    const { enabled } = getSharedOriginPlatformPolicy();
    return (
        enabled &&
        !state.props.horizontal &&
        numColumns === 1 &&
        state.props.experimentalPerf.sharedContainerOrigin &&
        state.props.stickyIndicesArr.length === 0
    );
}

export function shouldUseDeferredSharedOriginVisualAdjust(state: InternalState, numColumns: number) {
    const { allowDeferredVisualAdjust } = getSharedOriginPlatformPolicy();
    return (
        allowDeferredVisualAdjust &&
        canUseSharedContainerOrigin(state, numColumns) &&
        state.props.experimentalPerf.disableSharedOriginVisualAdjust
    );
}
