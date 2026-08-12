// Forked from https://github.com/Almouro/rn-list-comparison-movies
// Full credit to Alex Moreaux (@Almouro) for the original code

import { Image } from "expo-image";
import type * as React from "react";
import { useEffect, useRef } from "react";
import { Dimensions, FlatList, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { LegendList } from "@legendapp/list/react-native";
import { FlashList } from "@shopify/flash-list";
import type { DemoMetricStore } from "~/lib/demoMetrics";
import { getImageUrl, IMAGE_SIZE, type Movie, type Playlist } from "../api";
import { playlists as playlistData } from "../api/data/playlist";
import playlists from "../api/data/rows.json";

export type MovieListLibrary = "flatlist" | "flashlist" | "legendlist";

const margins = {
    l: 20,
    m: 10,
    s: 5,
};

const cardStyles = StyleSheet.create({
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#272829",
    },
    image: {
        borderRadius: 5,
        height: IMAGE_SIZE.height,
        width: IMAGE_SIZE.width,
    },
});

const rowStyles = StyleSheet.create({
    container: {
        marginBottom: margins.l,
        minHeight: cardStyles.image.height,
        width: Dimensions.get("window").width,
    },
    listContainer: {
        paddingHorizontal: margins.m,
    },
    title: {
        color: "white",
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: margins.s,
        marginHorizontal: margins.m,
    },
});

const listStyles = StyleSheet.create({
    container: {
        backgroundColor: "black",
        paddingVertical: margins.m,
    },
    fill: {
        ...StyleSheet.absoluteFillObject,
    },
});

function MoviePortrait({ metrics, movie }: { metrics?: DemoMetricStore; movie: Movie }) {
    const previousMovieId = useRef(movie.id);

    metrics?.increment("rowRenders");
    if (previousMovieId.current !== movie.id) {
        previousMovieId.current = movie.id;
        metrics?.increment("reassignments");
    }

    useEffect(() => {
        return metrics?.trackMount("mounted");
    }, [metrics]);

    return (
        <View style={cardStyles.image}>
            <View style={cardStyles.background} />
            <Image source={getImageUrl(movie.poster_path)} style={cardStyles.image} transition={0} />
        </View>
    );
}

function MarginBetweenItems() {
    return <View style={{ width: margins.s }} />;
}

type LibraryListProps<ItemT> = {
    contentContainerStyle?: StyleProp<ViewStyle>;
    data: readonly ItemT[];
    drawDistance: number;
    estimatedItemSize: number;
    horizontal?: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    keyExtractor?: (item: ItemT, index: number) => string;
    library: MovieListLibrary;
    recycleItems?: boolean;
    renderItem: (info: { index: number; item: ItemT }) => React.ReactElement;
    style?: StyleProp<ViewStyle>;
};

function LibraryList<ItemT>({
    contentContainerStyle,
    data,
    drawDistance,
    estimatedItemSize,
    horizontal,
    ItemSeparatorComponent,
    keyExtractor,
    library,
    recycleItems,
    renderItem,
    style,
}: LibraryListProps<ItemT>) {
    let list = (
        <LegendList
            contentContainerStyle={contentContainerStyle}
            data={data}
            drawDistance={drawDistance}
            estimatedItemSize={estimatedItemSize}
            horizontal={horizontal}
            ItemSeparatorComponent={ItemSeparatorComponent}
            keyExtractor={keyExtractor}
            recycleItems={recycleItems}
            renderItem={renderItem}
            style={style}
        />
    );

    if (library === "flatlist") {
        list = (
            <FlatList
                contentContainerStyle={contentContainerStyle}
                data={data}
                horizontal={horizontal}
                ItemSeparatorComponent={ItemSeparatorComponent}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                style={style}
            />
        );
    } else if (library === "flashlist") {
        list = (
            <FlashList
                contentContainerStyle={contentContainerStyle}
                data={data}
                drawDistance={drawDistance}
                horizontal={horizontal}
                ItemSeparatorComponent={ItemSeparatorComponent}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                style={style}
            />
        );
    }

    return list;
}

function MovieRow({
    library,
    metrics,
    playlist,
    recycleItems,
}: {
    library: MovieListLibrary;
    metrics?: DemoMetricStore;
    playlist: Playlist;
    recycleItems?: boolean;
}) {
    const movies = playlistData[playlist.id]();

    return (
        <>
            <Text numberOfLines={1} style={rowStyles.title}>
                {playlist.title}
            </Text>
            <View style={rowStyles.container}>
                <LibraryList
                    contentContainerStyle={rowStyles.listContainer}
                    data={movies}
                    drawDistance={500}
                    estimatedItemSize={cardStyles.image.width + margins.s}
                    horizontal
                    ItemSeparatorComponent={MarginBetweenItems}
                    keyExtractor={(movie) => movie.id.toString()}
                    library={library}
                    recycleItems={recycleItems}
                    renderItem={({ item }) => <MoviePortrait metrics={metrics} movie={item} />}
                />
            </View>
        </>
    );
}

export default function Movies({
    library,
    metrics,
    recycleItems,
}: {
    library: MovieListLibrary;
    metrics?: DemoMetricStore;
    recycleItems?: boolean;
}) {
    return (
        <LibraryList
            contentContainerStyle={listStyles.container}
            data={playlists}
            drawDistance={500}
            estimatedItemSize={cardStyles.image.height + 52}
            keyExtractor={(playlist) => playlist.id}
            library={library}
            recycleItems={recycleItems}
            renderItem={({ item }) => (
                <MovieRow library={library} metrics={metrics} playlist={item} recycleItems={recycleItems} />
            )}
            style={listStyles.fill}
        />
    );
}
