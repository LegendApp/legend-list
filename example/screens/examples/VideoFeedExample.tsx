import { useState } from "react";
import { type LayoutChangeEvent, Text, View } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { buildVideoFeed, type VideoClip } from "../../../examples-shared/media";
import { Shell, styles } from "./shared";

export function VideoFeedExample() {
    const [clips, setClips] = useState(() => buildVideoFeed());
    const [height, setHeight] = useState(0);

    const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
        setHeight(nativeEvent.layout.height);
    };

    return (
        <Shell>
            <View onLayout={onLayout} style={styles.videoShell}>
                {!!height && (
                    <LegendList
                        data={clips}
                        decelerationRate="fast"
                        estimatedItemSize={height}
                        keyExtractor={(item) => item.id}
                        onEndReached={() => {
                            setClips((current) => buildVideoFeed(current.length + 12).slice(0, current.length + 12));
                        }}
                        pagingEnabled
                        renderItem={({ item }: { item: VideoClip }) => (
                            <View style={[styles.videoSlide, { backgroundColor: item.color, height }]}>
                                <Text style={styles.videoCreator}>{item.creator}</Text>
                                <Text style={styles.videoTitle}>{item.title}</Text>
                                <Text style={styles.videoBody}>Swipe to the next clip</Text>
                            </View>
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </Shell>
    );
}
