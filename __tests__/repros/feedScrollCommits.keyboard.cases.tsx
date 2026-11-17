import { afterEach, beforeEach, expect, it, mock } from "bun:test";
import "../setup";

import { LegendList } from "../../src/components/LegendList";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { typedForwardRef } from "../../src/types.internal";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import { FeedSurface, GESTURES, installFeedClock, runFeedGesture } from "./feedScrollCommits.harness";

// The same feed through KeyboardAwareLegendList, as the device sample used it.
mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: FeedSurface,
    KeyboardController: { dismiss: () => Promise.resolve(), state: () => ({ height: 0 }) },
    useKeyboardHandler: () => {},
}));
mock.module("@legendapp/list/react-native", () => ({ internal: { typedForwardRef, useCombinedRef } }));
mock.module("@legendapp/list/reanimated", () => ({ AnimatedLegendList: LegendList }));

const COMMITS_372: Record<string, number> = { drag: 6, fling: 16 };
let clock: ReturnType<typeof installFeedClock>;

beforeEach(() => {
    registerReanimatedModuleMock();
    clock = installFeedClock();
});

afterEach(() => {
    clock.restore();
});

it.each(Object.keys(GESTURES))("%s through a keyboard-aware feed commits no more than 3.7.2", async (gesture) => {
    const { KeyboardAwareLegendList } = await import("../../src/integrations/keyboard?feed-commits");
    const result = await runFeedGesture(
        (props) => (
            <KeyboardAwareLegendList
                {...props}
                contentInset={{ top: 116 }}
                keyboardLiftBehavior="whenAtEnd"
                keyboardOffset={34}
            />
        ),
        gesture,
    );
    expect(result.startedAtEnd).toBe(true);
    // The scroll revealed the unmeasured tall row and MVCP absorbed its growth.
    expect(result.measuredTallRow).toBe(true);
    if (COMMITS_372[gesture] !== undefined) {
        expect(result.scrollCommits).toBeLessThanOrEqual(COMMITS_372[gesture]);
    }
    expect(result.rerenderCommits).toBeLessThanOrEqual(5);
});
