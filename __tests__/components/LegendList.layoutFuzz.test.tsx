import * as React from "react";
import { Text } from "react-native";

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
    checkLayoutInvariants,
    describeListState,
    installListRegistry,
    type LayoutViolation,
    type ListCtx,
} from "../../examples-shared/layoutInvariants";
import { batchItemSizeUpdates } from "../../src/core/updateItemSizes";
import { Platform } from "../../src/platform/Platform";
import { getContentSize } from "../../src/state/getContentSize";
import { listen$, peek$, type StateContext } from "../../src/state/state";
import type { LegendListRef } from "../../src/types.base";
import { skipLayoutInvariants } from "../helpers/layoutInvariantHarness";
import TestRenderer, { act } from "../helpers/testRenderer";
import { installFakeClock } from "../helpers/webScrollHarness";
import { registerBaseModuleMocks } from "../setup";

// Seeded layout fuzzer: renders a real LegendList against an emulated scroll view and checks the
// layout invariants (examples-shared/layoutInvariants.ts) after every frame of every step.
// A failure prints the seed, the config and a minimized step list to replay.
//   LL_FUZZ_SEEDS=5000 [LL_FUZZ_FIRST_SEED=1] [LL_FUZZ_STEPS=24]   long run (default: 24 seeds)
//   LL_FUZZ_SEED=123 [LL_FUZZ_REPLAY='[...]']                       one seed, optionally an exact step list
//   LL_FUZZ_PLATFORM=ios|android|web, LL_FUZZ_STRICT=1, LL_FUZZ_DEBUG=1|stack   replay aids
const SEED_COUNT = Number(process.env.LL_FUZZ_SEEDS ?? 24);
const FIRST_SEED = Number(process.env.LL_FUZZ_FIRST_SEED ?? 1);
const STEP_COUNT = Number(process.env.LL_FUZZ_STEPS ?? 24);
const STRICT = !!process.env.LL_FUZZ_STRICT;
const WIDTH = 320;
const VIEWPORT = 400;

// Pre-existing transient blanks (v3.6.0 has them too). They are tolerated for a few frames after the
// data change that causes them, so new regressions still fail; LL_FUZZ_STRICT=1 reports them too.
const KNOWN_ISSUES = {
    // A data change re-arms the initialScrollAtEnd bootstrap from offset 0, so it renders the first
    // rows while the view stays at the end until the bootstrap pass finishes.
    "bootstrap-retarget": (ctx: StateContext) => !!ctx.state.initialScrollSession?.bootstrap,
    // The range is clamped against the content size from before the data change's position pass, so
    // the commit renders from the stale offset until the scroll view's clamp event arrives.
    "shrink-past-offset": (ctx: StateContext) =>
        Math.max(ctx.state.scroll, device.offset) > Math.max(0, getContentSize(ctx) - ctx.state.scrollLength) + 1,
};
const KNOWN_ISSUE_GRACE_FRAMES = 3;
type KnownIssue = keyof typeof KNOWN_ISSUES;

type Item = { id: string };

type Config = {
    drawDistance: number;
    estimatedItemSize: number;
    fixedSizes: boolean;
    initialCount: number;
    initialScrollAtEnd: boolean;
    keyboard: { height: number; mode: "inset" | "resize" };
    maintainScrollAtEnd: boolean | { animated?: boolean; on?: { dataAppend?: boolean } };
    maintainVisibleContentPosition: boolean;
    platform: "ios" | "android" | "web";
    recycleItems: boolean;
};

type Step =
    | { t: "append" | "prepend"; n: number }
    | { t: "remove"; at: number; n: number }
    | { t: "replace"; n: number }
    | { t: "resize"; at: number; size: number }
    | { t: "keyboard"; open: boolean; follow: boolean }
    | { t: "drag"; to: number }
    | { t: "scrollToIndex"; animated: boolean; at: number; viewPosition: number }
    | { t: "scrollToEnd"; animated: boolean }
    | { t: "scrollToOffset"; animated: boolean; to: number }
    | { t: "wait"; frames: number };

type Failure = { frame: number; state: string; step: number; trigger: string; violations: LayoutViolation[] };

function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function generate(seed: number) {
    const random = mulberry32(seed);
    const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
    const pick = <T,>(values: readonly T[]) => values[Math.floor(random() * values.length)]!;
    const frac = () => Math.round(random() * 1000) / 1000;
    const config: Config = {
        drawDistance: pick([0, 50, 250]),
        estimatedItemSize: pick([40, 80, 120]),
        fixedSizes: random() < 0.15,
        initialCount: pick([0, 3, 12, 40]),
        initialScrollAtEnd: random() < 0.4,
        // An app avoids the keyboard one way: by insetting the list or by resizing it.
        keyboard: { height: pick([180, 260]), mode: pick(["inset", "resize"] as const) },
        maintainScrollAtEnd: pick([false, true, { animated: true }, { on: { dataAppend: true } }] as const),
        maintainVisibleContentPosition: random() < 0.7,
        platform: pick(["ios", "android", "web"] as const),
        recycleItems: random() < 0.5,
    };
    const steps: Step[] = [];
    for (let i = 0; i < STEP_COUNT; i++) {
        const animated = random() < 0.5;
        const roll = random();
        steps.push(
            roll < 0.14
                ? { n: int(1, 5), t: "append" }
                : roll < 0.24
                  ? { n: int(1, 6), t: "prepend" }
                  : roll < 0.29
                    ? { at: frac(), n: int(1, 3), t: "remove" }
                    : roll < 0.33
                      ? { n: pick([0, 2, 15, 50]), t: "replace" }
                      : roll < 0.46
                        ? { at: frac(), size: int(20, 260), t: "resize" }
                        : roll < 0.56
                          ? { follow: random() < 0.5, open: random() < 0.6, t: "keyboard" }
                          : roll < 0.7
                            ? { t: "drag", to: frac() }
                            : roll < 0.79
                              ? { animated, at: frac(), t: "scrollToIndex", viewPosition: pick([0, 0.5, 1]) }
                              : roll < 0.87
                                ? { animated, t: "scrollToEnd" }
                                : roll < 0.93
                                  ? { animated, t: "scrollToOffset", to: frac() }
                                  : { frames: int(1, 30), t: "wait" },
        );
    }
    // LL_FUZZ_PLATFORM replays a scenario on another platform.
    if (process.env.LL_FUZZ_PLATFORM) config.platform = process.env.LL_FUZZ_PLATFORM as Config["platform"];
    return { config, sizeSeed: int(1, 1 << 30), steps };
}

// Props the list passes to its scroll view (renderScrollComponent), i.e. the native event handlers.
let scrollProps: any;

const DeviceScrollView = React.forwardRef(function DeviceScrollViewComponent(props: any, ref: React.Ref<unknown>) {
    scrollProps = props;
    React.useImperativeHandle(ref, () => device.scroller, []);
    return <>{props.children}</>;
});

const renderScrollComponent = (props: any) => <DeviceScrollView {...props} />;

// The emulated native scroll view. Instant scrolls deliver their event on the next frame, animated
// scrolls move 30% of the way per frame, and ScrollAdjust shifts the offset like native MVCP does.
const device = {
    clamp(value: number) {
        // The list's content size already includes the reported end inset.
        const content = device.ctx ? getContentSize(device.ctx) : 0;
        return Math.max(0, Math.min(value, content - device.length));
    },
    ctx: undefined as StateContext | undefined,
    destination: undefined as number | undefined,
    event() {
        const content = device.ctx ? getContentSize(device.ctx) : 0;
        return {
            nativeEvent: {
                contentInset: { bottom: device.inset, left: 0, right: 0, top: 0 },
                contentOffset: { x: 0, y: device.offset },
                contentSize: { height: content, width: WIDTH },
                layoutMeasurement: { height: device.length, width: WIDTH },
            },
        };
    },
    inset: 0,
    length: VIEWPORT,
    offset: 0,
    pendingEvent: false,
    reset() {
        device.destination = undefined;
        device.inset = 0;
        device.length = VIEWPORT;
        device.offset = 0;
        device.pendingEvent = false;
        device.ctx = undefined;
    },
    scroller: {
        flashScrollIndicators: () => {},
        getCurrentScrollOffset: () => device.offset,
        getScrollableNode: () => ({}),
        getScrollEventTarget: () => null,
        getScrollResponder: () => null,
        measure: (cb: (x: number, y: number, width: number, height: number) => void) => cb(0, 0, WIDTH, device.length),
        scrollTo: ({ animated, y = 0 }: { animated?: boolean; y?: number }) => {
            if (process.env.LL_FUZZ_DEBUG)
                console.log(
                    `scrollTo ${y}${animated ? " animated" : ""}`,
                    process.env.LL_FUZZ_DEBUG === "stack" ? new Error().stack : "",
                );
            if (animated) {
                device.destination = y;
            } else {
                device.destination = undefined;
                device.offset = device.clamp(y);
                device.pendingEvent = true;
            }
        },
        scrollToEnd: ({ animated }: { animated?: boolean } = {}) =>
            device.scroller.scrollTo({ animated, y: Number.MAX_SAFE_INTEGER }),
    },
};

async function runScenario(seed: number, config: Config, steps: Step[], sizeSeed: number) {
    Platform.OS = config.platform;
    const random = mulberry32(sizeSeed);
    const sizes = new Map<string, number>();
    let nextId = 0;
    const makeItems = (n: number) =>
        Array.from({ length: n }, () => {
            const id = `s${seed}-${nextId++}`;
            sizes.set(id, 20 + Math.floor(random() * 160));
            return { id };
        });
    let data = makeItems(config.initialCount);
    const lists = new Set<ListCtx>();
    const uninstall = installListRegistry(lists);
    const clock = installFakeClock();
    const ref = React.createRef<LegendListRef>();
    const { LegendList } = await import("../../src/components/LegendList?layout-fuzz");
    const renderList = () => (
        <LegendList
            data={data}
            drawDistance={config.drawDistance}
            estimatedItemSize={config.estimatedItemSize}
            getFixedItemSize={config.fixedSizes ? (item: Item) => sizes.get(item.id) : undefined}
            initialScrollAtEnd={config.initialScrollAtEnd}
            keyExtractor={(item: Item) => item.id}
            maintainScrollAtEnd={config.maintainScrollAtEnd}
            maintainVisibleContentPosition={config.maintainVisibleContentPosition}
            recycleItems={config.recycleItems}
            ref={ref}
            renderItem={({ item }: { item: Item }) => <Text>{item.id}</Text>}
            renderScrollComponent={renderScrollComponent}
        />
    );

    let renderer: TestRenderer.ReactTestRenderer | undefined;
    let failure: Failure | undefined;
    let stepIndex = -1;
    let frameIndex = 0;
    let lastAdjust = 0;
    let graceFrames = 0;
    const knownHits = new Set<KnownIssue>();
    let unlisten: (() => void) | undefined;
    // Every frame must cover the viewport; positions and totals must be exact once a step settles.
    const check = (settled = false) => {
        for (const ctx of lists) {
            if (process.env.LL_FUZZ_DEBUG) {
                console.log(`step ${stepIndex} frame ${frameIndex} offset ${device.offset}: ${describeListState(ctx)}`);
            }
            if (failure) return;
            const violations = checkLayoutInvariants(ctx, {
                blankOnly: !settled,
                containerPositions: true,
                scrollOffset: device.offset,
            });
            const known =
                violations.length && !settled && !STRICT && graceFrames > 0
                    ? (Object.keys(KNOWN_ISSUES) as KnownIssue[]).find((name) =>
                          KNOWN_ISSUES[name](ctx as StateContext),
                      )
                    : undefined;
            if (known) {
                knownHits.add(known);
            } else if (violations.length) {
                const trigger = stepIndex < 0 ? "mount" : steps[stepIndex]!.t;
                failure = { frame: frameIndex, state: describeListState(ctx), step: stepIndex, trigger, violations };
            }
        }
    };
    // Rows measure when they commit (native layout effects, web layout effects). On web a later
    // size change of a mounted row arrives through ResizeObserver, after the frame's rAF work.
    const resizeObserved = new Set<string>();
    const measured = new WeakSet<object>();
    const measure = (fromResizeObserver: boolean) => {
        const ctx = device.ctx;
        if (!ctx || !renderer) return;
        // Each container's PositionView receives the row's onLayout, as on device.
        const views = renderer.root.findAll(
            (node) => typeof node.type !== "string" && typeof node.props.id === "number" && !!node.props.refView,
        );
        batchItemSizeUpdates(() => {
            for (const view of views) {
                const key = peek$(ctx, `containerItemKey${view.props.id}`);
                const size = key === undefined ? undefined : sizes.get(key);
                if (key === undefined || size === undefined || resizeObserved.has(key) !== fromResizeObserver) continue;
                if (ctx.state.sizesKnown.get(key) !== size || !measured.has(view)) {
                    measured.add(view);
                    view.props.onLayout?.({ nativeEvent: { layout: { height: size, width: WIDTH, x: 0, y: 0 } } });
                }
            }
        });
    };
    const frame = async () => {
        frameIndex++;
        graceFrames--;
        await act(async () => {
            if (!device.ctx) {
                device.ctx = [...lists][0] as StateContext | undefined;
                if (device.ctx) {
                    const ctx = device.ctx;
                    unlisten = listen$(ctx, "scrollAdjust", (value) => {
                        const delta = (value || 0) - lastAdjust;
                        lastAdjust = value || 0;
                        if (delta) {
                            // Native MVCP shifts the offset by the adjust; web ScrollAdjust scrolls to the
                            // list's intended offset (with temporary end padding, so it is not clamped yet).
                            device.offset =
                                config.platform === "web"
                                    ? Math.max(0, ctx.state.scroll)
                                    : device.clamp(device.offset + delta);
                            device.pendingEvent = true;
                        }
                    });
                }
            }
            if (device.destination !== undefined) {
                const target = device.clamp(device.destination);
                const next = device.offset + (target - device.offset) * 0.3;
                device.offset = Math.abs(target - next) < 1 ? target : next;
                if (device.offset === target) device.destination = undefined;
                scrollProps?.onScroll?.(device.event());
                if (device.destination === undefined) scrollProps?.onMomentumScrollEnd?.(device.event());
            } else if (device.pendingEvent || device.offset !== device.clamp(device.offset)) {
                // Scroll views clamp the offset when the content shrinks below it.
                device.offset = device.clamp(device.offset);
                device.pendingEvent = false;
                scrollProps?.onScroll?.(device.event());
            }
            measure(false);
            clock.tick(16);
            measure(true);
            resizeObserved.clear();
            await Promise.resolve();
        });
        check();
    };
    const frames = async (count: number) => {
        for (let i = 0; i < count && (!failure || process.env.LL_FUZZ_DEBUG); i++) await frame();
    };
    const setData = async (next: Item[]) => {
        data = next;
        graceFrames = KNOWN_ISSUE_GRACE_FRAMES;
        await act(async () => renderer!.update(renderList()));
        check();
    };
    const indexOf = (at: number) => Math.min(data.length - 1, Math.floor(at * data.length));

    try {
        await act(async () => {
            renderer = TestRenderer.create(renderList());
        });
        await act(async () => {
            scrollProps?.onLayout?.({ nativeEvent: { layout: { height: VIEWPORT, width: WIDTH, x: 0, y: 0 } } });
        });
        await frames(20);
        for (stepIndex = 0; stepIndex < steps.length && !failure; stepIndex++) {
            const step = steps[stepIndex]!;
            switch (step.t) {
                case "append":
                    await setData([...data, ...makeItems(step.n)]);
                    break;
                case "prepend":
                    await setData([...makeItems(step.n), ...data]);
                    break;
                case "remove":
                    if (data.length) {
                        const at = indexOf(step.at);
                        await setData([...data.slice(0, at), ...data.slice(at + step.n)]);
                    }
                    break;
                case "replace":
                    await setData(makeItems(step.n));
                    break;
                case "resize":
                    if (data.length) {
                        const id = data[indexOf(step.at)]!.id;
                        sizes.set(id, step.size);
                        if (config.platform === "web") resizeObserved.add(id);
                        if (config.fixedSizes) await setData([...data]);
                    }
                    break;
                case "keyboard": {
                    const height = step.open ? config.keyboard.height : 0;
                    await act(async () => {
                        if (config.keyboard.mode === "resize") {
                            device.inset = 0;
                            device.length = VIEWPORT - height;
                            scrollProps?.onLayout?.({
                                nativeEvent: { layout: { height: device.length, width: WIDTH, x: 0, y: 0 } },
                            });
                        } else {
                            device.length = VIEWPORT;
                            device.inset = height;
                            ref.current?.reportContentInset({ bottom: height });
                        }
                        // Keyboard controllers lift the content by the keyboard height when following.
                        device.offset = device.clamp(device.offset + (step.open && step.follow ? height : 0));
                        scrollProps?.onScroll?.(device.event());
                    });
                    check();
                    break;
                }
                case "drag": {
                    device.destination = undefined;
                    const target = device.clamp(step.to * (getContentSize(device.ctx!) - device.length));
                    await act(async () => scrollProps?.onInternalScrollBeginDrag?.(device.event()));
                    for (let i = 1; i <= 4 && !failure; i++) {
                        device.offset = device.offset + (target - device.offset) / (5 - i);
                        device.pendingEvent = true;
                        await frame();
                    }
                    await act(async () => scrollProps?.onInternalScrollEndDrag?.(device.event()));
                    await act(async () => scrollProps?.onMomentumScrollEnd?.(device.event()));
                    check();
                    break;
                }
                case "scrollToIndex":
                    if (data.length) {
                        await act(async () => {
                            ref.current?.scrollToIndex({
                                animated: step.animated,
                                index: indexOf(step.at),
                                viewPosition: step.viewPosition,
                            });
                        });
                        check();
                    }
                    break;
                case "scrollToEnd":
                    await act(async () => {
                        ref.current?.scrollToEnd({ animated: step.animated });
                    });
                    check();
                    break;
                case "scrollToOffset":
                    await act(async () => {
                        ref.current?.scrollToOffset({
                            animated: step.animated,
                            offset: step.to * Math.max(0, getContentSize(device.ctx!) - device.length),
                        });
                    });
                    check();
                    break;
                case "wait":
                    await frames(step.frames);
                    break;
            }
            await frames(12);
            check(true);
        }
        if (failure) failure.step = Math.min(failure.step, steps.length - 1);
    } finally {
        unlisten?.();
        await act(async () => renderer?.unmount());
        clock.restore();
        uninstall();
        device.reset();
        lastAdjust = 0;
    }
    return { failure, knownHits };
}

/** Drops steps that are not needed to reproduce the failure. */
async function minimize(seed: number, config: Config, steps: Step[], sizeSeed: number, failure: Failure) {
    let current = steps.slice(0, failure.step + 1);
    let currentFailure = failure;
    for (let i = current.length - 1; i >= 0; i--) {
        const candidate = [...current.slice(0, i), ...current.slice(i + 1)];
        const { failure: candidateFailure } = await runScenario(seed, config, candidate, sizeSeed);
        if (candidateFailure?.violations[0]?.kind === failure.violations[0]?.kind) {
            current = candidate.slice(0, candidateFailure.step + 1);
            currentFailure = candidateFailure;
            i = Math.min(i, current.length);
        }
    }
    return { failure: currentFailure, steps: current };
}

function getSeeds() {
    if (process.env.LL_FUZZ_SEED) return [Number(process.env.LL_FUZZ_SEED)];
    return Array.from({ length: SEED_COUNT }, (_, i) => FIRST_SEED + i);
}

beforeEach(() => {
    mock.restore();
    registerBaseModuleMocks();
    // The fuzzer checks every frame itself and reports the seed; the per-act harness would throw first.
    skipLayoutInvariants();
});

afterEach(() => {
    Platform.OS = "ios";
});

describe("LegendList layout fuzz", () => {
    it.each(["ios", "android", "web"] as const)(
        "keeps the viewport covered after prepending then removing near the end (%s, seed 99)",
        async (platform) => {
            const { config, sizeSeed } = generate(99);
            const { failure } = await runScenario(
                99,
                { ...config, platform },
                [
                    { n: 1, t: "prepend" },
                    { at: 0.744, n: 2, t: "remove" },
                ],
                sizeSeed,
            );
            expect(failure).toBeUndefined();
        },
    );

    it.each(["ios", "android", "web"] as const)(
        "keeps the tail covered after removing then appending back (%s, seed 99)",
        async (platform) => {
            const { config, sizeSeed } = generate(99);
            const { failure } = await runScenario(
                99,
                { ...config, platform },
                [
                    { at: 0.744, n: 2, t: "remove" },
                    { n: 2, t: "append" },
                ],
                sizeSeed,
            );
            expect(failure).toBeUndefined();
        },
    );

    it(`keeps layout invariants across ${getSeeds().length} seeded scenarios`, async () => {
        const failures: string[] = [];
        const known = new Map<KnownIssue, number[]>();
        for (const seed of getSeeds()) {
            const generated = generate(seed);
            const steps: Step[] = process.env.LL_FUZZ_REPLAY ? JSON.parse(process.env.LL_FUZZ_REPLAY) : generated.steps;
            const { failure, knownHits } = await runScenario(seed, generated.config, steps, generated.sizeSeed);
            for (const name of knownHits) known.set(name, [...(known.get(name) ?? []), seed]);
            if (failure) {
                const minimal = await minimize(seed, generated.config, steps, generated.sizeSeed, failure);
                failures.push(
                    [
                        `seed ${seed} (${generated.config.platform}, after ${minimal.failure.trigger}): ${JSON.stringify(minimal.failure.violations.slice(0, 2))}`,
                        `  at step ${minimal.failure.step} frame ${minimal.failure.frame}: ${minimal.failure.state}`,
                        `  config ${JSON.stringify(generated.config)}`,
                        `  replay: LL_FUZZ_SEED=${seed} LL_FUZZ_REPLAY='${JSON.stringify(minimal.steps)}'`,
                    ].join("\n"),
                );
            }
        }
        if (process.env.LL_FUZZ_SEEDS || process.env.LL_FUZZ_SEED) {
            for (const [name, seeds] of known) {
                console.log(`known issue ${name}: ${seeds.length} seeds (first ${seeds.slice(0, 5).join(", ")})`);
            }
        }
        if (failures.length) console.log(failures.join("\n"));
        expect(failures).toEqual([]);
    }, 600_000);
});
