// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated } from "react-native";

import { LegendList, type LegendListProps, type LegendListRef } from "@legendapp/list/react-native";

// Typed explicitly: the inferred `Animated.AnimatedComponent<typeof LegendList>` reads the component as its
// props type under React Native's strict TypeScript API (0.87+), so no LegendList prop typechecks there.
type AnimatedLegendListDefinition = <ItemT = any>(
    props: Animated.AnimatedProps<LegendListProps<ItemT>> & { ref?: React.Ref<LegendListRef> },
) => React.ReactElement | null;

const AnimatedLegendList = Animated.createAnimatedComponent(LegendList) as AnimatedLegendListDefinition;

export { AnimatedLegendList };
