import React from "react";

import { type AdaptiveRender, LegendList, useAdaptiveRender } from "@legendapp/list/react";
import {
    DEFAULT_WEB_ADAPTIVE_RENDER_ENTER_VELOCITY,
    DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_DELAY,
    DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_VELOCITY,
} from "@/core/adaptiveRender";

type FeedItem = {
    accent: string;
    category: string;
    id: string;
    metric: string;
    summary: string;
    title: string;
};

const CATEGORIES = ["Analytics", "Design", "Ops", "Growth", "Support", "Infra"];
const ACCENTS = ["#2563eb", "#059669", "#dc2626", "#7c3aed", "#ea580c", "#0891b2"];

function createFeedItems(count: number): FeedItem[] {
    return Array.from({ length: count }, (_, index) => {
        const category = CATEGORIES[index % CATEGORIES.length];
        return {
            accent: ACCENTS[index % ACCENTS.length],
            category,
            id: String(index),
            metric: `${Math.round(48 + ((index * 13) % 47))}%`,
            summary:
                "Rich mode renders preview media, metadata, and chart details. Light mode keeps this row cheap while velocity is high.",
            title: `${category} update ${index + 1}`,
        };
    });
}

const DATA = createFeedItems(2000);

function ModeBadge({ mode }: { mode: AdaptiveRender }) {
    return (
        <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold uppercase"
            style={{
                background: mode === "light" ? "#fef3c7" : "#dcfce7",
                color: mode === "light" ? "#92400e" : "#166534",
            }}
        >
            {mode}
        </span>
    );
}

function Sparkline({ accent, index, mode }: { accent: string; index: number; mode: AdaptiveRender }) {
    return (
        <div className="mt-3 flex h-10 items-end gap-1">
            {mode === "light"
                ? Array.from({ length: 18 }, (_, barIndex) => (
                      <div className="w-1.5 rounded-t bg-[#e5e7eb]" key={barIndex} style={{ height: 8 }} />
                  ))
                : Array.from({ length: 18 }, (_, barIndex) => {
                      const height = 8 + ((index * 7 + barIndex * 11) % 30);
                      return (
                          <div
                              className="w-1.5 rounded-t"
                              key={barIndex}
                              style={{
                                  background: accent,
                                  height,
                                  opacity: 0.25 + (barIndex % 4) * 0.15,
                              }}
                          />
                      );
                  })}
        </div>
    );
}

function ScoreValue({ metric, mode }: { metric: string; mode: AdaptiveRender }) {
    return mode === "light" ? <span className="inline-block h-3 w-7 rounded bg-[#cbd5e1] align-middle" /> : metric;
}

function FeedRow({ index, item }: { index: number; item: FeedItem }) {
    const mode = useAdaptiveRender();

    return (
        <article className="border-b border-[#e5e7eb] bg-white px-4 py-4">
            <div className="flex gap-4">
                <div
                    className="flex h-20 w-24 shrink-0 items-end rounded-md p-2 text-xs font-semibold text-white"
                    style={{
                        background: `linear-gradient(135deg, ${item.accent}, #111827)`,
                    }}
                >
                    {item.category}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold uppercase text-[#64748b]">Row {index + 1}</div>
                            <h3 className="mt-1 text-base font-semibold text-[#0f172a]">{item.title}</h3>
                        </div>
                        <ModeBadge mode={mode} />
                    </div>
                    <p className="mt-2 max-w-[720px] text-sm leading-5 text-[#475569]">{item.summary}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-[#475569]">
                        <span className="rounded bg-[#f1f5f9] px-2 py-1">
                            score <ScoreValue metric={item.metric} mode={mode} />
                        </span>
                        <span className="rounded bg-[#f1f5f9] px-2 py-1">render {mode}</span>
                        <span className="rounded bg-[#f1f5f9] px-2 py-1">id {item.id}</span>
                    </div>
                    <Sparkline accent={item.accent} index={index} mode={mode} />
                </div>
            </div>
        </article>
    );
}

export default function AdaptiveRenderExample() {
    const [enabled, setEnabled] = React.useState(true);
    const [enterVelocity, setEnterVelocity] = React.useState(DEFAULT_WEB_ADAPTIVE_RENDER_ENTER_VELOCITY);
    const [exitVelocity, setExitVelocity] = React.useState(DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_VELOCITY);
    const [exitDelay, setExitDelay] = React.useState(DEFAULT_WEB_ADAPTIVE_RENDER_EXIT_DELAY);
    const [mode, setMode] = React.useState<AdaptiveRender>("normal");
    const [changedAt, setChangedAt] = React.useState(() => new Date().toLocaleTimeString());

    const adaptiveRender = React.useMemo(
        () =>
            enabled
                ? {
                      enterVelocity,
                      exitDelay,
                      exitVelocity,
                      onChange: (nextMode: AdaptiveRender) => {
                          setMode(nextMode);
                          setChangedAt(new Date().toLocaleTimeString());
                      },
                  }
                : undefined,
        [enabled, enterVelocity, exitDelay, exitVelocity],
    );

    React.useEffect(() => {
        if (!enabled) {
            setMode("normal");
            setChangedAt(new Date().toLocaleTimeString());
        }
    }, [enabled]);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] bg-white px-4 py-3">
                <div className="mr-auto">
                    <div className="text-sm font-semibold text-[#0f172a]">Adaptive render feed</div>
                    <div className="text-xs text-[#64748b]">Fast scroll switches rows to a cheaper light render.</div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
                    Enabled
                </label>
                <label className="flex items-center gap-2 text-xs text-[#475569]">
                    Enter
                    <input
                        className="w-20"
                        max={32}
                        min={0.5}
                        onChange={(event) => setEnterVelocity(Number(event.target.value))}
                        step={0.1}
                        type="range"
                        value={enterVelocity}
                    />
                    {enterVelocity.toFixed(1)}
                </label>
                <label className="flex items-center gap-2 text-xs text-[#475569]">
                    Exit
                    <input
                        className="w-20"
                        max={12}
                        min={0}
                        onChange={(event) => setExitVelocity(Number(event.target.value))}
                        step={0.1}
                        type="range"
                        value={exitVelocity}
                    />
                    {exitVelocity.toFixed(1)}
                </label>
                <label className="flex items-center gap-2 text-xs text-[#475569]">
                    Delay
                    <input
                        className="w-20"
                        max={2000}
                        min={0}
                        onChange={(event) => setExitDelay(Number(event.target.value))}
                        step={100}
                        type="range"
                        value={exitDelay}
                    />
                    {exitDelay}ms
                </label>
            </div>
            <div className="pointer-events-none absolute right-4 top-20 z-10 rounded-md border border-[#e5e7eb] bg-white/95 px-3 py-2 shadow-sm">
                <div className="flex items-center gap-2">
                    <ModeBadge mode={mode} />
                    <span className="text-xs text-[#64748b]">changed {changedAt}</span>
                </div>
            </div>
            <LegendList<FeedItem>
                className="min-h-0 flex-1"
                data={DATA}
                estimatedItemSize={136}
                experimental_adaptiveRender={adaptiveRender}
                keyExtractor={(item) => item.id}
                recycleItems
                renderItem={({ item, index }) => <FeedRow index={index} item={item} />}
            />
        </div>
    );
}
