// biome-ignore lint/correctness/noUnusedImports: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated } from "react-native";

import { LegendList } from "@legendapp/list";

const AnimatedLegendList = Animated.createAnimatedComponent(LegendList);

export { AnimatedLegendList };
