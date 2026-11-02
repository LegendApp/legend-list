import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import "../setup";

import * as React from "react";

import { getCurrentTargetOffset } from "../../src/core/checkFinishedScroll";
import * as platformScroll from "../../src/core/doScrollTo";
import { doScrollTo as doNativeScrollTo } from "../../src/core/doScrollTo.native";
import { onScroll } from "../../src/core/onScroll";
import { scrollToEnd } from "../../src/core/scrollToEnd";
import { useCombinedRef } from "../../src/hooks/useCombinedRef";
import { typedForwardRef } from "../../src/types.internal";
import { createImperativeHandle } from "../../src/utils/createImperativeHandle";
import { createMockContext } from "../__mocks__/createMockContext";
import { registerReanimatedModuleMock } from "../__mocks__/reanimated";
import TestRenderer, { act } from "../helpers/testRenderer";
import { installFakeClock } from "../helpers/webScrollHarness";

type Event = { height: number; progress: number; duration: number };
type Handler = Partial<Record<"onStart" | "onMove" | "onEnd", (event: Event) => void>>;
const handlers: Handler[] = [];
const reactions: Array<() => boolean> = [];
const offset = { value: 0 };
const commands: number[] = [];
const insetReports: number[] = [];
const frames: Array<() => void> = [];
let listProps: any;
let controller: any;
let coreHandle: ReturnType<typeof createImperativeHandle> | undefined;

// Reanimated reruns a reaction when a captured shared value changes, even if its output does not.
let writes = 0;
const shared = <T,>(initial: T) => {
    let value = initial;
    return {
        get value() {
            return value;
        },
        set value(next: T) {
            if (!Object.is(next, value)) writes++;
            value = next;
        },
    };
};
const flush = () => {
    for (let pass = 0; pass < 20; pass++) {
        if (!reactions.map((reaction) => reaction()).some(Boolean)) return;
    }
    throw new Error("Animated reactions did not settle");
};
const emit = (name: keyof Handler, height: number) => {
    for (const handler of handlers) handler[name]?.({ duration: 300, height, progress: height / 300 });
    flush();
};

// Run the installed controller hooks, replacing only native event/ref plumbing.
mock.module("react-native-keyboard-controller/src/hooks", () => ({
    useKeyboardHandler: (handler: Handler) => handlers.push(handler),
}));
mock.module("react-native-keyboard-controller/src/components/hooks/useScrollState", () => ({
    default: () => ({
        layout: { value: { height: 800, width: 400 } },
        offset,
        onContentSizeChange: () => {},
        onLayout: () => {},
        size: { value: { height: 2000, width: 400 } },
    }),
}));
mock.module("react-native-keyboard-controller", () => ({
    KeyboardChatScrollView: () => null,
    KeyboardController: { dismiss: () => Promise.resolve(), state: () => ({ height: 0 }) },
    useKeyboardHandler: (handler: Handler) => handlers.push(handler),
}));
mock.module("@legendapp/list/react-native", () => ({ internal: { typedForwardRef, useCombinedRef } }));
mock.module("@legendapp/list/reanimated", () => ({
    AnimatedLegendList: React.forwardRef((props: any, ref) => {
        listProps = props;
        React.useImperativeHandle(
            ref,
            () =>
                coreHandle ?? {
                    reportContentInset: (insets: { bottom: number }) => {
                        if (insets.bottom !== insetReports.at(-1)) insetReports.push(insets.bottom);
                    },
                },
        );
        return null;
    }),
}));

beforeEach(() => {
    coreHandle = undefined;
    handlers.length = 0;
    reactions.length = 0;
    commands.length = 0;
    insetReports.length = 0;
    frames.length = 0;
    offset.value = 1200;
    spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
        frames.push(() => callback(0));
        return 0;
    });
    registerReanimatedModuleMock({
        interpolate: (value: number, [a, b]: number[], [c, d]: number[]) => c + ((value - a) / (b - a)) * (d - c),
        makeMutable: shared,
        scrollTo: (_ref: unknown, _x: number, y: number) => {
            commands.push(y);
            offset.value = y;
        },
        useAnimatedReaction: (prepare: () => unknown, react: (current: any, previous: any) => void) => {
            let previous: unknown = null;
            let seen = -1;
            reactions.push(() => {
                const current = prepare();
                if (seen === writes && JSON.stringify(current) === JSON.stringify(previous)) return false;
                seen = writes;
                const old = previous;
                previous = current;
                react(current, old);
                return true;
            });
        },
        useDerivedValue: (prepare: () => unknown) => ({
            get value() {
                return prepare();
            },
        }),
        useScrollViewOffset: () => offset,
        useSharedValue: shared,
    });
});

const mount = async (
    platform: string,
    freeze: { value: boolean },
    blankSpace: number,
    staticInset = 0,
    openHeight = 300,
    nativeRequest?: { start: number; maintain: boolean; missingBridge?: boolean; following?: boolean },
) => {
    const { Platform } = await import("react-native");
    (Platform as any).OS = platform;
    const { KeyboardAwareLegendList, useKeyboardScrollToEnd } = await import(
        "../../src/integrations/keyboard?keyboard-close"
    );
    const { useAnimatedReaction } = await import("react-native-reanimated");
    const { useChatKeyboard } =
        platform === "ios"
            ? await import(
                  "react-native-keyboard-controller/src/components/KeyboardChatScrollView/useChatKeyboard/index.ios"
              )
            : await import(
                  "react-native-keyboard-controller/src/components/KeyboardChatScrollView/useChatKeyboard/index"
              );
    const { useFrozenPadding } = await import(
        "react-native-keyboard-controller/src/components/KeyboardChatScrollView/useFrozenPadding"
    );
    const { useExtraContentPadding } =
        platform === "ios"
            ? await import(
                  "react-native-keyboard-controller/src/components/KeyboardChatScrollView/useExtraContentPadding?ios"
              )
            : await import(
                  "react-native-keyboard-controller/src/components/KeyboardChatScrollView/useExtraContentPadding?android"
              );
    let scrollProps: any;
    function ControllerProbe() {
        const props = scrollProps;
        controller = useChatKeyboard({ current: null } as any, {
            ...props,
            extraContentPadding: props.extraContentPadding ?? shared(0),
            inverted: false,
            keyboardLiftBehavior: "always",
            offset: 20,
        });
        useExtraContentPadding({
            ...controller,
            blankSpace: props.blankSpace,
            extraContentPadding: props.extraContentPadding ?? shared(0),
            freeze,
            inverted: false,
            keyboardLiftBehavior: "always",
            keyboardPadding: controller.padding,
            scrollViewRef: (() => true) as any,
        });
        useFrozenPadding({ freeze, offset: 20, padding: controller.padding });
        // Same inset reporting boundary as ScrollViewWithBottomPadding: there
        // must be no new range report for end-follow to act on at release.
        useAnimatedReaction(
            () =>
                staticInset +
                Math.min(
                    800,
                    Math.max(
                        props.blankSpace.value,
                        controller.padding.value + (props.extraContentPadding?.value ?? 0),
                    ),
                ),
            (current, previous) => {
                if (current !== previous) props.onContentInsetChange({ bottom: current, left: 0, right: 0, top: 0 });
            },
        );
        return null;
    }
    let renderer!: TestRenderer.ReactTestRenderer;
    let probe!: TestRenderer.ReactTestRenderer;
    let finishScroll!: () => void;
    let request: Promise<void>;
    let startClose!: (closeKeyboard?: boolean, animated?: boolean) => void;
    const listRef = {
        current: {
            scrollToEnd: () =>
                new Promise<void>((resolve) => {
                    finishScroll = resolve;
                }),
        },
    };
    const { Platform: CorePlatform } = await import("../../src/platform/Platform");
    CorePlatform.OS = platform as "ios" | "android";
    const nativeCommands: Array<{ y: number; animated: boolean }> = [];
    const ctx = nativeRequest
        ? createMockContext(
              { isFollowingEnd: !!nativeRequest.following, totalSize: 2000 },
              {
                  didContainersLayout: true,
                  didFinishInitialScroll: true,
                  lastLayout: { height: 800, width: 400, x: 0, y: 0 },
                  // Rows end below the open-range offset, as in a chat that is at its end.
                  positions: Array.from({ length: 20 }, (_, i) => i * 100),
                  props: {
                      data: Array.from({ length: 20 }, (_, i) => i),
                      getFixedItemSize: () => 100,
                      maintainScrollAtEnd: nativeRequest.maintain ? {} : undefined,
                  },
                  refScroller: {
                      current: {
                          scrollTo: (command: { y: number; animated: boolean }) => nativeCommands.push(command),
                      },
                  } as any,
                  scroll: nativeRequest.start,
                  scrollLength: 800,
                  scrollPending: nativeRequest.start,
                  sizes: new Map(Array.from({ length: 20 }, (_, i) => [`item_${i}`, 100])),
              },
          )
        : undefined;
    if (ctx) {
        ctx.scrollToEnd = (options) => scrollToEnd(ctx, options);
        coreHandle = createImperativeHandle(ctx);
        if (nativeRequest?.missingBridge) delete coreHandle.reportContentInsetForScrollInternal;
        listRef.current = coreHandle;
        spyOn(platformScroll, "doScrollTo").mockImplementation(doNativeScrollTo);
    }
    function ListProbe() {
        const { scrollMessageToEnd } = useKeyboardScrollToEnd({ freeze: freeze as any, listRef });
        startClose = (closeKeyboard = true, animated = !!nativeRequest) => {
            request = scrollMessageToEnd({ animated, closeKeyboard });
        };
        return (
            <KeyboardAwareLegendList
                anchoredEndSpace={blankSpace ? { anchorIndex: 0 } : undefined}
                contentInset={{ bottom: staticInset }}
                contentInsetEndAdjustment={shared(40) as any}
                data={["row"]}
                freeze={freeze as any}
                keyboardOffset={20}
                renderItem={() => null}
            />
        );
    }
    act(() => {
        renderer = TestRenderer.create(<ListProbe />);
    });
    scrollProps = listProps.renderScrollComponent({});
    listProps.anchoredEndSpace?.onSizeChanged(blankSpace);
    scrollProps.props.onLayout?.({ nativeEvent: { layout: { height: 800, width: 400 } } });
    scrollProps.props.onContentSizeChange?.(400, 2000);
    scrollProps = scrollProps.props;
    act(() => {
        probe = TestRenderer.create(<ControllerProbe />);
    });
    flush();
    emit("onStart", 300);
    emit("onMove", openHeight);
    if (openHeight === 300) emit("onEnd", 300);
    // iOS emits a native animated offset target rather than scrollTo.
    offset.value = 1200 + (platform === "ios" ? staticInset : 0) + Math.max(blankSpace, 320);
    commands.length = 0;
    if (nativeRequest) offset.value = nativeRequest.start;
    return {
        composer: scrollProps.extraContentPadding,
        ctx,
        done: () => request,
        frame: () => {
            for (const frame of frames.splice(0)) frame();
            flush();
        },
        inset: () => insetReports.at(-1),
        nativeCommands,
        nativeFrame: (y: number) => {
            offset.value = y;
            onScroll(ctx!, {
                nativeEvent: {
                    contentInset: {
                        bottom: controller.padding.value + scrollProps.extraContentPadding.value,
                        left: 0,
                        right: 0,
                        top: 0,
                    },
                    contentOffset: { x: 0, y },
                    contentSize: { height: ctx!.state.totalSize, width: 400 },
                    layoutMeasurement: { height: 800, width: 400 },
                },
            } as any);
            flush();
        },
        release: async () => {
            finishScroll();
            await request;
        },
        setBlankSpace: (size: number) => listProps.anchoredEndSpace.onSizeChanged(size),
        startClose,
        unmount: () =>
            act(() => {
                probe.unmount();
                renderer.unmount();
            }),
    };
};

describe("immediate end scroll with frozen keyboard close", () => {
    for (const platform of ["ios", "android"]) {
        for (const staticInset of [0, 32]) {
            it(`${platform}: follows every closing frame to the true end (static inset=${staticInset})`, async () => {
                const freeze = shared(false);
                const harness = await mount(platform, freeze, 0, staticInset);
                try {
                    const trueEnd = 1240 + (platform === "ios" ? staticInset : 0);
                    harness.startClose();
                    flush();
                    emit("onStart", 0);
                    expect(offset.value).toBe(trueEnd + 280); // No #557 onStart jump.
                    let previous = offset.value;
                    for (const height of [270, 210, 150, 90, 30, 0]) {
                        emit("onMove", height);
                        const end = trueEnd + (height * 280) / 300;
                        expect(harness.inset()).toBe(height === 0 ? trueEnd - 1200 : trueEnd - 1200 + 280);
                        expect(offset.value).toBeCloseTo(end, 5);
                        expect(offset.value).toBeLessThan(previous);
                        expect(offset.value).toBeGreaterThanOrEqual(trueEnd);
                        previous = offset.value;
                    }
                    emit("onEnd", 0);
                    const count = commands.length;
                    const reportCount = insetReports.length;
                    await harness.release();
                    flush();
                    harness.frame();
                    expect(commands).toHaveLength(count);
                    expect(insetReports).toHaveLength(reportCount);
                    expect(harness.inset()).toBe(trueEnd - 1200);
                    expect(offset.value).toBe(trueEnd);
                } finally {
                    harness.unmount();
                }
            });
        }
        it(`${platform}: tracks the end when close interrupts keyboard opening`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0, 0, 150);
            try {
                harness.startClose();
                flush();
                emit("onStart", 0);
                for (const height of [120, 90, 60, 30, 0]) {
                    emit("onMove", height);
                    expect(harness.inset()).toBe(height === 0 ? 40 : 320);
                    expect(offset.value).toBeCloseTo(1240 + (height * 280) / 300, 5);
                }
                emit("onEnd", 0);
                await harness.release();
                flush();
                harness.frame();
                expect(offset.value).toBe(1240);
                expect(harness.inset()).toBe(40);
            } finally {
                harness.unmount();
            }
        });
        it(`${platform}: leaves a forward end scroll from history alone until it reaches the shrinking range`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0);
            try {
                harness.startClose();
                flush();
                offset.value = 300;
                emit("onStart", 0);
                let previous = offset.value;
                for (const height of [240, 180, 120]) {
                    offset.value += 300;
                    emit("onMove", height);
                    expect(commands).toHaveLength(0);
                    expect(offset.value).toBeGreaterThanOrEqual(previous);
                    previous = offset.value;
                }
                offset.value = 1500;
                emit("onMove", 60);
                expect(commands).toEqual([1240]);
                expect(offset.value).toBeGreaterThanOrEqual(previous);
                emit("onMove", 0);
                expect(commands).toEqual([1240]);
                emit("onEnd", 0);
                await harness.release();
                flush();
                harness.frame();
                expect(commands).toEqual([1240]);
            } finally {
                harness.unmount();
            }
        });
        it(`${platform}: clamps a scroll that reaches the end after the last keyboard frame`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0);
            try {
                harness.startClose();
                flush();
                offset.value = 300;
                emit("onStart", 0);
                emit("onMove", 0);
                emit("onEnd", 0);
                expect(commands).toHaveLength(0);
                offset.value = 1400;
                flush();
                expect(commands).toEqual([1240]);
                await harness.release();
                flush();
                harness.frame();
                expect(commands).toEqual([1240]);
            } finally {
                harness.unmount();
            }
        });
        it(`${platform}: stops unwinding where partial anchored end space absorbs the keyboard`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 150);
            try {
                harness.startClose();
                flush();
                emit("onStart", 0);
                for (const height of [270, 210, 150, 90, 30, 0]) {
                    emit("onMove", height);
                    const end = 1200 + Math.max(150, 40 + (height * 280) / 300);
                    expect(offset.value).toBeCloseTo(end, 5);
                    expect(harness.inset()).toBe(height === 0 ? 150 : 320);
                }
                emit("onEnd", 0);
                const count = commands.length;
                await harness.release();
                flush();
                harness.frame();
                expect(commands).toHaveLength(count);
                expect(offset.value).toBe(1350);
            } finally {
                harness.unmount();
            }
        });
        it(`${platform}: does not pull a forward end scroll backward or disturb absorbed end space`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 500);
            try {
                harness.startClose();
                flush();
                offset.value = 700;
                emit("onStart", 0);
                for (const height of [240, 180, 120, 60, 0]) {
                    offset.value += 200; // Native forward scroll in progress.
                    emit("onMove", height);
                    expect(commands).toHaveLength(0);
                    expect(harness.inset()).toBe(500);
                }
                emit("onEnd", 0);
                await harness.release();
                flush();
                expect(commands).toHaveLength(0);
                expect(offset.value).toBe(1700);
                expect(harness.inset()).toBe(500);
            } finally {
                harness.unmount();
            }
        });
        it(`${platform}: does not restore an offset already unwound during an overlapping request`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0);
            try {
                harness.startClose();
                flush();
                emit("onStart", 0);
                emit("onMove", 150);
                expect(offset.value).toBe(1380);
                offset.value = 1260;
                flush();
                // Another native request must not lift the offset again.
                offset.value = 1320;
                emit("onStart", 0);
                expect(offset.value).toBe(1260);
                emit("onMove", 0);
                emit("onEnd", 0);
                expect(offset.value).toBe(1240);
                await harness.release();
                flush();
                expect(freeze.value).toBe(false);
            } finally {
                harness.unmount();
            }
        });
        for (const closeKeyboard of [false, true]) {
            it(`${platform}: clears the close clamp before a keyboard-closed request (closeKeyboard=${closeKeyboard})`, async () => {
                const freeze = shared(false);
                const harness = await mount(platform, freeze, 0);
                try {
                    harness.startClose();
                    flush();
                    emit("onStart", 0);
                    emit("onMove", 0);
                    emit("onEnd", 0);
                    await harness.release();
                    flush();
                    commands.length = 0;
                    // A new message has grown native content before its JS size report.
                    harness.startClose(closeKeyboard);
                    flush();
                    offset.value = 1400;
                    flush();
                    expect(commands).toHaveLength(0);
                    expect(offset.value).toBe(1400);
                    await harness.release();
                    flush();
                    expect(freeze.value).toBe(false);
                } finally {
                    harness.unmount();
                }
            });
        }
        it(`${platform}: preserves a layout freeze that is not owned by an end scroll`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0);
            try {
                freeze.value = true;
                flush();
                emit("onStart", 0);
                emit("onMove", 150);
                emit("onMove", 0);
                emit("onEnd", 0);
                expect(commands).toHaveLength(0);
                expect(harness.inset()).toBe(320);
                expect(offset.value).toBe(1520);
                freeze.value = false;
                flush();
                expect(commands).toHaveLength(0);
                expect(harness.inset()).toBe(40);
                harness.startClose(false);
                flush();
                offset.value = 1400;
                flush();
                expect(commands).toHaveLength(0);
                expect(offset.value).toBe(1400);
                await harness.release();
            } finally {
                harness.unmount();
            }
        });
    }
});

describe("keyboard movement at the end", () => {
    for (const platform of ["ios", "android"]) {
        it(`${platform}: leaves an unfrozen keyboard close to the controller and resumes following afterward`, async () => {
            const harness = await mount(platform, shared(false), 0, 0, 300, {
                following: true,
                maintain: true,
                start: 1240,
            });
            try {
                for (let i = 0; i < 4; i++) {
                    harness.frame();
                    harness.nativeFrame(1520);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
                expect(harness.ctx!.state.maintainingScrollAtEnd).toBeUndefined();
                harness.nativeCommands.length = 0;
                emit("onStart", 0);
                if (platform === "ios") expect(controller.contentOffsetY.value).toBe(1240);
                emit("onMove", 150);
                for (let i = 0; i < 4; i++) {
                    harness.frame();
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
                expect(harness.nativeCommands).toEqual([]);
                emit("onMove", 0);
                emit("onEnd", 0);
                for (let i = 0; i < 4; i++) {
                    harness.frame();
                    harness.nativeFrame(1240);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
                harness.nativeCommands.length = 0;
                harness.composer.value = 60;
                flush();
                for (let i = 0; i < 4; i++) {
                    harness.frame();
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
                expect(harness.nativeCommands).toEqual([{ animated: false, x: 0, y: 1260 }]);
            } finally {
                harness.ctx!.state.scheduledWork.dispose();
                harness.unmount();
            }
        });

        it(`${platform}: leaves the opening lift to the controller without an end-follow scroll`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0, 0, 300, {
                following: true,
                maintain: true,
                start: 1240,
            });
            try {
                // Settle at the closed end, then open the keyboard again.
                for (const name of ["onStart", "onMove", "onEnd"] as const) emit(name, 0);
                for (let i = 0; i < 4; i++) {
                    harness.frame();
                    harness.nativeFrame(1240);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
                expect(harness.ctx!.state.maintainingScrollAtEnd).toBeUndefined();
                harness.nativeCommands.length = 0;
                for (const name of ["onStart", "onMove", "onEnd"] as const) emit(name, 300);
                expect(harness.ctx!.state.contentInsetOverride?.bottom).toBe(320);
                for (let i = 0; i < 4; i++) {
                    harness.frame();
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
                expect(harness.nativeCommands).toEqual([]);
            } finally {
                harness.ctx!.state.scheduledWork.dispose();
                harness.unmount();
            }
        });
    }
});

describe("animated end scroll with frozen keyboard close", () => {
    for (const platform of ["ios", "android"]) {
        for (const maintain of [false, true]) {
            for (const change of ["composer shrinks", "composer grows", "blank space shrinks"]) {
                it(`${platform}: keeps the closed range when ${change} (maintain=${maintain})`, async () => {
                    const freeze = shared(false);
                    const blank = change === "blank space shrinks" ? 500 : 0;
                    const harness = await mount(platform, freeze, blank, 32, 300, { maintain, start: 300 });
                    const clock = installFakeClock();
                    spyOn(Date, "now").mockImplementation(() => clock.now);
                    try {
                        harness.startClose();
                        const oldEnd = harness.nativeCommands[0].y;
                        emit("onStart", 0);
                        emit("onMove", 150);
                        if (blank) harness.setBlankSpace(150);
                        else harness.composer.value = change === "composer shrinks" ? 10 : 70;
                        flush();
                        const trueEnd = 1200 + (blank ? 150 : harness.composer.value) + (platform === "ios" ? 32 : 0);
                        const state = harness.ctx!.state;
                        expect(state.contentInsetOverride?.bottom).toBe(trueEnd - 1200);
                        expect(getCurrentTargetOffset(harness.ctx!, state.scrollingTo!)).toBe(trueEnd);
                        harness.nativeFrame(oldEnd);
                        emit("onMove", 0);
                        emit("onEnd", 0);
                        // Let the existing fallback correct only the composer/blank-space delta.
                        clock.advance(600);
                        expect(harness.nativeCommands.at(-1)?.y).toBe(trueEnd);
                        expect(harness.nativeCommands).toHaveLength(2);
                        harness.nativeFrame(trueEnd);
                        clock.tick();
                        await harness.done();
                        flush();
                        clock.advance(2000);
                        expect(harness.nativeCommands.map(({ y }) => y)).toEqual([oldEnd, trueEnd]);
                        expect(commands).toHaveLength(0);
                        expect(state.scroll).toBe(trueEnd);
                        expect(state.scrollPending).toBe(trueEnd);
                        expect(state.scrollingTo).toBeUndefined();
                        expect(freeze.value).toBe(false);
                    } finally {
                        harness.ctx!.state.scheduledWork.dispose();
                        clock.restore();
                        mock.restore();
                        harness.unmount();
                    }
                });
            }
        }
        it(`${platform}: restores the open range if dismissal times out`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0, 32, 300, { maintain: false, start: 300 });
            const clock = installFakeClock();
            const { KeyboardController } = await import("react-native-keyboard-controller");
            spyOn(KeyboardController, "dismiss").mockImplementation(() => new Promise(() => {}));
            try {
                harness.startClose();
                await Promise.resolve(); // Start dismiss after the UI freeze acknowledgement.
                harness.nativeFrame(1240 + (platform === "ios" ? 32 : 0));
                clock.tick();
                clock.advance(1900);
                for (let i = 0; i < 10; i++) await Promise.resolve();
                expect(freeze.value).toBe(true); // Android can take ~1.8 s to report the close.
                clock.advance(100);
                await harness.done();
                flush();
                expect(freeze.value).toBe(false);
                expect(harness.ctx!.state.contentInsetOverride?.bottom).toBe(320 + (platform === "ios" ? 32 : 0));
                harness.startClose(false);
                expect(harness.nativeCommands.at(-1)?.y).toBe(1520 + (platform === "ios" ? 32 : 0));
                harness.nativeFrame(harness.nativeCommands.at(-1)!.y);
                clock.tick();
                await harness.done();
            } finally {
                harness.ctx!.state.scheduledWork.dispose();
                clock.restore();
                mock.restore();
                harness.unmount();
            }
        });
        it(`${platform}: keeps the close clamp if the private range bridge is missing`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0, 0, 300, {
                maintain: false,
                missingBridge: true,
                start: 300,
            });
            const clock = installFakeClock();
            try {
                harness.startClose();
                expect(harness.nativeCommands[0].y).toBe(1520);
                emit("onStart", 0);
                harness.nativeFrame(1500);
                expect(commands).toEqual([1240]);
                emit("onMove", 0);
                emit("onEnd", 0);
                harness.nativeFrame(1240);
                clock.tick();
                await harness.done();
                flush();
                expect(freeze.value).toBe(false);
                expect(harness.ctx!.state.scroll).toBe(1240);
            } finally {
                harness.ctx!.state.scheduledWork.dispose();
                clock.restore();
                mock.restore();
                harness.unmount();
            }
        });
        for (const closeKeyboard of [false, true]) {
            it(`${platform}: keeps native animation ownership for an overlapping request (closeKeyboard=${closeKeyboard})`, async () => {
                const freeze = shared(false);
                const harness = await mount(platform, freeze, 0, 0, 300, { maintain: true, start: 1520 });
                const clock = installFakeClock();
                try {
                    harness.startClose();
                    emit("onStart", 0);
                    harness.nativeFrame(1380);
                    emit("onMove", 150);
                    harness.startClose(closeKeyboard);
                    // Repeated close-start events must not restore the old UI clamp.
                    emit("onStart", 0);
                    harness.nativeFrame(1270);
                    emit("onMove", 30);
                    harness.nativeFrame(1240);
                    emit("onMove", 0);
                    emit("onEnd", 0);
                    clock.tick();
                    await harness.done();
                    flush();
                    clock.advance(2000);
                    expect(commands).toHaveLength(0);
                    expect(harness.nativeCommands).toEqual([
                        { animated: true, x: 0, y: 1240 },
                        { animated: true, x: 0, y: 1240 },
                    ]);
                    expect(harness.ctx!.state.scroll).toBe(1240);
                    expect(harness.ctx!.state.scrollingTo).toBeUndefined();
                    expect(freeze.value).toBe(false);
                } finally {
                    harness.ctx!.state.scheduledWork.dispose();
                    clock.restore();
                    mock.restore();
                    harness.unmount();
                }
            });
        }
        it(`${platform}: sends a non-animated close once, to the closed end`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0, 0, 300, { maintain: true, start: 1520 });
            const state = harness.ctx!.state;
            const clock = installFakeClock();
            try {
                harness.startClose(true, false);
                expect(harness.nativeCommands).toEqual([{ animated: false, x: 0, y: 1240 }]);
                harness.nativeFrame(1240);
                emit("onStart", 0);
                emit("onMove", 150);
                harness.nativeFrame(1240);
                emit("onMove", 0);
                emit("onEnd", 0);
                for (let i = 0; i < 4; i++) {
                    clock.tick();
                    clock.advance(150);
                }
                await harness.done();
                flush();
                clock.advance(2000);
                expect(harness.nativeCommands).toEqual([{ animated: false, x: 0, y: 1240 }]);
                expect(commands).toHaveLength(0);
                expect(state.scroll).toBe(1240);
                expect(freeze.value).toBe(false);
            } finally {
                state.scheduledWork.dispose();
                clock.restore();
                mock.restore();
                harness.unmount();
            }
        });
        it(`${platform}: keeps the closed range for a non-animated send during an animated close`, async () => {
            const freeze = shared(false);
            const harness = await mount(platform, freeze, 0, 0, 300, { maintain: true, start: 300 });
            const state = harness.ctx!.state;
            const clock = installFakeClock();
            try {
                harness.startClose();
                emit("onStart", 0);
                harness.nativeFrame(800);
                emit("onMove", 150);
                harness.startClose(true, false);
                flush();
                harness.composer.value = 10;
                flush();
                expect(state.contentInsetOverride?.bottom).toBe(10);
                expect(getCurrentTargetOffset(harness.ctx!, state.scrollingTo!)).toBe(1210);
                harness.nativeFrame(harness.nativeCommands.at(-1)!.y);
                emit("onMove", 0);
                emit("onEnd", 0);
                clock.tick();
                clock.advance(600);
                harness.nativeFrame(harness.nativeCommands.at(-1)!.y);
                clock.tick();
                await harness.done();
                flush();
                clock.advance(2000);
                expect(commands).toHaveLength(0);
                expect(Math.max(...harness.nativeCommands.map(({ y }) => y))).toBe(1240);
                expect(state.scroll).toBe(1210);
                expect(state.scrollingTo).toBeUndefined();
                expect(freeze.value).toBe(false);
            } finally {
                state.scheduledWork.dispose();
                clock.restore();
                mock.restore();
                harness.unmount();
            }
        });
        for (const maintain of [false, true]) {
            for (const sends of [1, 2]) {
                it(`${platform}: eases ${sends} appended send(s) from the end without a past-end clamp (maintain=${maintain})`, async () => {
                    const freeze = shared(false);
                    const harness = await mount(platform, freeze, 0, 0, 300, { maintain, start: 1520 });
                    const state = harness.ctx!.state;
                    const append = () => {
                        const index = state.props.data.length;
                        state.positions.push(index * 100);
                        state.sizes.set(`item_${index}`, 100);
                        state.props.data = [...state.props.data, index];
                        harness.ctx!.values.set("totalSize", state.props.data.length * 100);
                        return state.props.data.length * 100 - 800 + 40;
                    };
                    const clock = installFakeClock();
                    try {
                        let trueEnd = append();
                        harness.startClose();
                        emit("onStart", 0);
                        const offsets = sends === 2 ? [1500, 1470] : [1500, 1450, 1400, 1360, trueEnd];
                        for (const [i, y] of offsets.entries()) {
                            harness.nativeFrame(y);
                            emit("onMove", 300 - (i + 1) * 50);
                            clock.tick();
                        }
                        if (sends === 2) {
                            trueEnd = append();
                            harness.startClose();
                            for (const y of [1460, 1450, trueEnd]) {
                                harness.nativeFrame(y);
                                clock.tick();
                            }
                        }
                        emit("onMove", 0);
                        emit("onEnd", 0);
                        clock.tick();
                        await harness.done();
                        flush();
                        clock.advance(2000);
                        // Native animations own the close: no past-end clamp or UI-thread command. A second
                        // send replaces the first animation without a plain stop.
                        expect(harness.nativeCommands).toEqual(
                            sends === 1
                                ? [{ animated: true, x: 0, y: 1340 }]
                                : [
                                      { animated: true, x: 0, y: 1340 },
                                      { animated: true, x: 0, y: 1440 },
                                  ],
                        );
                        expect(commands).toHaveLength(0);
                        expect(state.scroll).toBe(trueEnd);
                        expect(state.scrollingTo).toBeUndefined();
                        expect(freeze.value).toBe(false);
                    } finally {
                        state.scheduledWork.dispose();
                        clock.restore();
                        mock.restore();
                        harness.unmount();
                    }
                });
            }
        }
        for (const maintain of [false, true]) {
            for (const { start, blank, staticInset, openHeight } of [
                { blank: 0, openHeight: 300, start: 300, staticInset: 0 },
                { blank: 0, openHeight: 300, start: 1520, staticInset: 0 },
                { blank: 150, openHeight: 300, start: 300, staticInset: 32 },
                { blank: 500, openHeight: 300, start: 1700, staticInset: 0 },
                { blank: 0, openHeight: 150, start: 300, staticInset: 0 },
            ]) {
                it(`${platform}: eases from ${start} to the closed end (maintain=${maintain}, blank=${blank}, static=${staticInset}, open=${openHeight})`, async () => {
                    const freeze = shared(false);
                    const harness = await mount(platform, freeze, blank, staticInset, openHeight, { maintain, start });
                    const trueEnd = 1200 + Math.max(blank, 40) + (platform === "ios" ? staticInset : 0);
                    const clock = installFakeClock();
                    try {
                        harness.startClose();
                        // The first native command is synchronous and already targets the closed range.
                        expect(harness.nativeCommands).toEqual([{ animated: true, x: 0, y: trueEnd }]);
                        const target = harness.ctx!.state.scrollingTo!;
                        expect(getCurrentTargetOffset(harness.ctx!, target)).toBe(trueEnd);
                        emit("onStart", 0);
                        for (const [i, height] of [270, 210, 150, 90, 30, 0].entries()) {
                            const progress = (i + 1) / 6;
                            const eased = (1 - Math.cos(Math.PI * progress)) / 2;
                            harness.nativeFrame(start + (trueEnd - start) * eased);
                            emit("onMove", height);
                            clock.tick();
                            expect(commands).toHaveLength(0); // No nonanimated command cuts the native curve.
                        }
                        emit("onEnd", 0);
                        await harness.done();
                        flush();
                        clock.advance(2000);
                        expect(harness.ctx!.state.scroll).toBe(trueEnd);
                        expect(harness.ctx!.state.scrollPending).toBe(trueEnd);
                        expect(harness.ctx!.state.scrollingTo).toBeUndefined();
                        expect(harness.ctx!.state.scheduledWork.has("checkFinishedScrollFallback")).toBe(false);
                        expect(harness.nativeCommands).toHaveLength(1); // Neither end-follow nor fallback reissues.
                        expect(commands).toHaveLength(0);
                        expect(freeze.value).toBe(false);
                    } finally {
                        harness.ctx!.state.scheduledWork.dispose();
                        clock.restore();
                        mock.restore();
                        harness.unmount();
                    }
                });
            }
        }
    }
});
