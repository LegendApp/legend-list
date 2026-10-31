import * as React from "react";

import { IsNewArchitecture } from "@/constants-platform";
import { measureContainersInLayoutEffect } from "@/core/measureContainersInLayoutEffect";
import { getContainerLayoutEffectScope } from "@/core/scheduleContainerLayout";
import { Platform } from "@/platform/Platform";
import { useArr$, useStateContext } from "@/state/state";
import { typedMemo } from "@/types.internal";
import { sortContainerElements } from "@/utils/reordering";

// Keep committed-container measurement scheduling out of the visual container layer.
// As the parent of the slots, this layout effect runs after their layout effects have
// added every committed container id to the pending measurement scope.
export const ContainerLayoutCoordinator = typedMemo(function ContainerLayoutCoordinatorComponent({
    children,
}: {
    children: React.ReactNode;
}) {
    const ctx = useStateContext();
    const [containerLayoutEpoch] = useArr$(["containerLayoutEpoch"]);

    React.useLayoutEffect(() => {
        if (Platform.OS === "web") {
            // Keep DOM order (read by screen readers and tab order) in item order within the
            // same commit, before measurement reads layout, so moves share one layout pass.
            sortContainerElements(ctx);
        }
        if (IsNewArchitecture) {
            const targetContainerIds = getContainerLayoutEffectScope(ctx);
            if (targetContainerIds !== undefined) {
                measureContainersInLayoutEffect(ctx, targetContainerIds);
            }
        }
    }, [ctx, containerLayoutEpoch]);

    return children;
});
