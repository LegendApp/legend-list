import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { LegendList, type LegendListRenderItemProps, useRecyclingState } from "@legendapp/list/react-native";
import { buildFeedCards, type FeedCard } from "../../../examples-shared/commerce";
import { Shell, styles } from "./shared";

function getFeedPollVotes(optionId: string, selectedOptionId: string | null, votes: number) {
    return votes + (selectedOptionId === optionId ? 1 : 0);
}

function FeedCardItem({ item, extraData }: LegendListRenderItemProps<FeedCard>) {
    const [isExpandedValue, setExpanded] = extraData?.recycleState ? useRecyclingState(() => false) : useState(false);
    const [isLikedValue, setLiked] = extraData?.recycleState ? useRecyclingState(() => false) : useState(false);
    const [selectedOptionIdValue, setSelectedOptionId] = extraData?.recycleState
        ? useRecyclingState<string | null>(() => null)
        : useState<string | null>(null);

    const isExpanded = Boolean(isExpandedValue);
    const isLiked = Boolean(isLikedValue);
    const selectedOptionId = selectedOptionIdValue ?? null;

    return (
        <View style={styles.feedCard}>
            <View style={styles.feedHeader}>
                <View style={[styles.feedAvatar, { backgroundColor: item.accentColor }]}>
                    <Text style={styles.feedAvatarText}>{item.author.slice(0, 1)}</Text>
                </View>
                <View style={styles.personCopy}>
                    <Text style={styles.personName}>{item.author}</Text>
                    <Text style={styles.personMeta}>{item.timestampLabel}</Text>
                </View>
                <View style={styles.feedKindBadge}>
                    <Text style={styles.feedKindBadgeText}>{item.kind}</Text>
                </View>
            </View>

            {item.kind === "story" ? (
                <>
                    <View style={styles.feedCategoryChip}>
                        <Text style={styles.feedCategoryChipText}>{item.categoryLabel}</Text>
                    </View>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                </>
            ) : null}

            {item.kind === "photo" ? (
                <>
                    <View
                        style={[styles.feedMediaCard, { backgroundColor: item.accentColor, height: item.mediaHeight }]}
                    >
                        <Text style={styles.feedMediaLabel}>{item.mediaLabel}</Text>
                        <Text style={styles.feedMediaTitle}>{item.title}</Text>
                        <Text style={styles.feedMediaSubtitle}>{item.mediaSubtitle}</Text>
                    </View>
                    <Text style={styles.body}>{item.body}</Text>
                </>
            ) : null}

            {item.kind === "poll" ? (
                <>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                    <View style={styles.feedPollList}>
                        {item.pollOptions.map((option) => {
                            const isSelected = selectedOptionId === option.id;
                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => {
                                        if (!isSelected) {
                                            setSelectedOptionId(option.id);
                                        }
                                    }}
                                    style={[styles.feedPollOption, isSelected && styles.feedPollOptionSelected]}
                                >
                                    <Text style={styles.feedPollOptionLabel}>{option.label}</Text>
                                    <Text style={styles.feedPollOptionVotes}>
                                        {getFeedPollVotes(option.id, selectedOptionId, option.votes)} votes
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </>
            ) : null}

            {item.kind === "quote" ? (
                <>
                    <View style={[styles.feedQuoteCard, { borderLeftColor: item.accentColor }]}>
                        <Text style={styles.feedQuoteText}>"{item.quote}"</Text>
                        <Text style={styles.personMeta}>{item.source}</Text>
                    </View>
                    <Text style={styles.body}>{item.body}</Text>
                </>
            ) : null}

            {item.kind === "event" ? (
                <>
                    <View style={styles.feedEventBadgeRow}>
                        <View style={styles.feedEventBadge}>
                            <Text style={styles.feedEventBadgeText}>{item.highlight}</Text>
                        </View>
                        <View style={styles.feedCategoryChip}>
                            <Text style={styles.feedCategoryChipText}>{item.attendeesLabel}</Text>
                        </View>
                    </View>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                    <Text style={styles.personMeta}>{item.location}</Text>
                </>
            ) : null}

            {item.kind !== "poll" && isExpanded ? (
                <Text style={styles.feedExpandedBody}>{item.expandedBody}</Text>
            ) : null}

            <View style={styles.feedActionRow}>
                <Pressable
                    onPress={() => setLiked((current) => !current)}
                    style={[styles.button, isLiked && styles.buttonActive]}
                >
                    <Text style={[styles.buttonText, isLiked && styles.buttonTextActive]}>
                        {isLiked ? "Liked" : "Like"} · {item.reactionCount + (isLiked ? 1 : 0)}
                    </Text>
                </Pressable>
                <Text style={styles.personMeta}>{item.commentCount} comments</Text>
                {item.kind !== "poll" ? (
                    <Pressable onPress={() => setExpanded((current) => !current)} style={styles.button}>
                        <Text style={styles.buttonText}>{isExpanded ? "Collapse" : "Expand"}</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

export function CardsFeedExample() {
    const feed = useMemo(() => buildFeedCards(), []);

    return (
        <Shell>
            <LegendList
                contentContainerStyle={styles.list}
                data={feed}
                estimatedItemSize={286}
                extraData={{ recycleState: true }}
                keyExtractor={(item) => item.id}
                renderItem={FeedCardItem}
            />
        </Shell>
    );
}
