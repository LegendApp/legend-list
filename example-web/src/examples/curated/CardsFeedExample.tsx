import React, { memo } from "react";

import { LegendList, type LegendListRenderItemProps, useRecyclingState } from "@legendapp/list/react";
import { buildFeedCards, type FeedCard, type FeedPollOption } from "@examples/commerce";
import { buttonStyle, CARD_CLASS, Shell } from "./shared";

const feedCards = buildFeedCards();

function pollVotesForOption(optionId: string, option: FeedPollOption, selectedOptionId: string | null) {
    return option.votes + (selectedOptionId === optionId ? 1 : 0);
}

const FeedCardItem = memo(({ item, extraData }: LegendListRenderItemProps<FeedCard>) => {
    const [isExpandedValue, setExpanded] = extraData?.recycleState
        ? useRecyclingState(() => false)
        : React.useState(false);
    const [isLikedValue, setLiked] = extraData?.recycleState ? useRecyclingState(() => false) : React.useState(false);
    const [selectedOptionIdValue, setSelectedOptionId] = extraData?.recycleState
        ? useRecyclingState<string | null>(() => null)
        : React.useState<string | null>(null);

    const isExpanded = Boolean(isExpandedValue);
    const isLiked = Boolean(isLikedValue);
    const selectedOptionId = selectedOptionIdValue ?? null;

    return (
        <div className={`${CARD_CLASS} bg-white`}>
            <div className="mb-3 flex items-center gap-3">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-full font-extrabold text-[#0f172a]"
                    style={{
                        background: item.accentColor,
                    }}
                >
                    {item.author.slice(0, 1)}
                </div>
                <div className="flex-1">
                    <div className="font-extrabold">{item.author}</div>
                    <div className="text-[13px] text-[#64748b]">{item.timestampLabel}</div>
                </div>
                <div className="rounded-full bg-[#eef2ff] px-[10px] py-[6px] text-xs font-bold capitalize text-[#4338ca]">
                    {item.kind}
                </div>
            </div>

            {item.kind === "story" ? (
                <>
                    <div className="mb-[10px] inline-block rounded-full bg-[#f8fafc] px-[10px] py-[6px] text-xs font-bold text-[#334155]">
                        {item.categoryLabel}
                    </div>
                    <div className="text-lg font-extrabold">{item.title}</div>
                    <div className="mt-[10px] leading-[1.55] text-[#334155]">{item.body}</div>
                </>
            ) : null}

            {item.kind === "photo" ? (
                <>
                    <div
                        className="mb-3 flex flex-col justify-end rounded-[18px] p-[14px] text-[#0f172a]"
                        style={{
                            background: item.accentColor,
                            height: item.mediaHeight,
                        }}
                    >
                        <div className="text-xs font-extrabold uppercase opacity-[0.72]">{item.mediaLabel}</div>
                        <div className="mt-1.5 text-[20px] font-extrabold">{item.title}</div>
                        <div className="mt-1.5 max-w-[260px] opacity-[0.78]">{item.mediaSubtitle}</div>
                    </div>
                    <div className="leading-[1.55] text-[#334155]">{item.body}</div>
                </>
            ) : null}

            {item.kind === "poll" ? (
                <>
                    <div className="text-lg font-extrabold">{item.title}</div>
                    <div className="mt-[10px] leading-[1.55] text-[#334155]">{item.body}</div>
                    <div className="mt-[14px] grid gap-[10px]">
                        {item.pollOptions.map((option) => {
                            const votes = pollVotesForOption(option.id, option, selectedOptionId);
                            const totalVotes = item.totalVotes + (selectedOptionId ? 1 : 0);
                            const width = `${Math.max(18, Math.round((votes / totalVotes) * 100))}%`;
                            const isSelected = selectedOptionId === option.id;
                            return (
                                <button
                                    className="cursor-pointer overflow-hidden rounded-2xl p-0 text-left"
                                    key={option.id}
                                    onClick={() => {
                                        if (!isSelected) {
                                            setSelectedOptionId(option.id);
                                        }
                                    }}
                                    style={{
                                        background: isSelected ? "#dbeafe" : "#f8fafc",
                                        border: isSelected ? "1px solid #60a5fa" : "1px solid #e2e8f0",
                                    }}
                                    type="button"
                                >
                                    <div
                                        className="h-full px-[14px] py-3"
                                        style={{
                                            background: isSelected ? "#bfdbfe" : "#e2e8f0",
                                            height: "100%",
                                            minWidth: width,
                                        }}
                                    >
                                        <div className="font-bold">{option.label}</div>
                                        <div className="mt-1 text-xs text-[#64748b]">{votes} votes</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : null}

            {item.kind === "quote" ? (
                <>
                    <div
                        className="rounded-2xl bg-[#f8fafc] p-4"
                        style={{
                            borderLeft: `4px solid ${item.accentColor}`,
                        }}
                    >
                        <div className="text-[20px] leading-[1.5] font-bold text-[#0f172a]">"{item.quote}"</div>
                        <div className="mt-[10px] text-[#64748b]">{item.source}</div>
                    </div>
                    <div className="mt-3 leading-[1.55] text-[#334155]">{item.body}</div>
                </>
            ) : null}

            {item.kind === "event" ? (
                <>
                    <div className="mb-3 flex gap-2">
                        <div className="rounded-full bg-[#dcfce7] px-[10px] py-[6px] text-xs font-bold text-[#166534]">
                            {item.highlight}
                        </div>
                        <div className="rounded-full bg-[#f8fafc] px-[10px] py-[6px] text-xs font-bold text-[#334155]">
                            {item.attendeesLabel}
                        </div>
                    </div>
                    <div className="text-lg font-extrabold">{item.title}</div>
                    <div className="mt-[10px] leading-[1.55] text-[#334155]">{item.body}</div>
                    <div className="mt-3 text-[#64748b]">{item.location}</div>
                </>
            ) : null}

            {item.kind !== "poll" && isExpanded ? (
                <div className="mt-[14px] leading-[1.6] text-[#334155]">{item.expandedBody}</div>
            ) : null}

            <div className="mt-4 flex gap-[10px]">
                <button className={buttonStyle(isLiked)} onClick={() => setLiked((current) => !current)} type="button">
                    {isLiked ? "Liked" : "Like"} · {item.reactionCount + (isLiked ? 1 : 0)}
                </button>
                <div className="self-center text-[13px] text-[#64748b]">{item.commentCount} comments</div>
                {item.kind !== "poll" ? (
                    <button className={buttonStyle()} onClick={() => setExpanded((current) => !current)} type="button">
                        {isExpanded ? "Collapse" : "Expand"}
                    </button>
                ) : null}
            </div>
        </div>
    );
});

export function CardsFeedExample() {
    return (
        <Shell title="Cards Feed">
            <LegendList
                className="min-h-0 min-w-0 flex-1"
                contentContainerStyle={{ padding: 8 }}
                data={feedCards}
                estimatedItemSize={286}
                extraData={{ recycleState: true }}
                keyExtractor={(item) => item.id}
                renderItem={FeedCardItem}
            />
        </Shell>
    );
}
