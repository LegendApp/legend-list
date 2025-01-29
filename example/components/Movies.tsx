// Forked from https://github.com/Almouro/rn-list-comparison-movies
// Full credit to Alex Moreaux (@Almouro) for the original code

import { LegendList, type LegendListRenderItemProps } from "@legendapp/list";
import { FlashList } from "@shopify/flash-list";
import {Image} from 'expo-image'
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { IMAGE_SIZE, type Movie, type Playlist, getImageUrl } from "../api";
import { playlists as playlistData } from "../api/data/playlist";

const itemCount = 0;

const cardStyles = StyleSheet.create({
    image: {
        width: IMAGE_SIZE.width,
        height: IMAGE_SIZE.height,
        borderRadius: 5,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#272829",
    },
});

const MoviePortrait = ({ movie }: { movie: Movie }) => {
    return (
        <View style={cardStyles.image}>
            <View style={cardStyles.background} />
            <Image
                key={movie.id}
                source={{ uri: getImageUrl(movie.poster_path) }}
                style={cardStyles.image}
                transition={0}
            />
        </View>
    );
};

const MarginBetweenItems = () => <View style={{ width: margins.s }} />;

const margins = {
    s: 5,
    m: 10,
    l: 20,
};

const rowStyles = StyleSheet.create({
    title: {
        fontSize: 20,
        fontWeight: "bold",
        color: "white",
        marginHorizontal: margins.m,
        marginBottom: margins.s,
    },
    container: {
        minHeight: cardStyles.image.height,
        marginBottom: margins.l,
        width: Dimensions.get("window").width,
    },
    listContainer: {
        paddingHorizontal: margins.m,
    },
});

const rowCount = 0;

const MovieRow = ({
    playlist,
    ListComponent,
    isLegend,
   // useRecyclingState,
}: {
    playlist: Playlist;
    ListComponent: typeof FlashList | typeof LegendList;
    isLegend: boolean;
    // useRecyclingState: LegendListRenderItemProps<Playlist>["useRecyclingState"];
}) => {
    const movies = playlistData[playlist.id]();
    const DRAW_DISTANCE_ROW = isLegend ? 500 : 250;
    // let opacity = 0;
    // if (isLegend) {
    //     const [_opacity, setOpacity] = useRecyclingState<number>(() => {
    //         if (setOpacity) {
    //             requestAnimationFrame(() => setOpacity(1));
    //             return 0;
    //         }
    //         return 1;
    //     });
    //     opacity = _opacity;
    // } else {
    // opacity = 1;
    // }

    // const listRef = useRef<FlashList<Movie>>(null);

    //   const {onMomentumScrollBegin, onScroll} = useRememberListScroll(
    //     listRef,
    //     playlist.id,
    //   );

    // useEffect(() => {
    //     rowCount++;
    //     console.log("rowCount", rowCount);
    // }, []);

    // const fadeAnim = useRef(new Animated.Value(0)).current;
    // // useEffect(() => {
    // //     itemCount++;
    // //     console.log("itemCount", itemCount);
    // // }, []);

    // useRecyclingEffect(() => {
    //     console.log("useRecyclingEffect");
    //     fadeAnim.setValue(0);
    //     Animated.timing(fadeAnim, {
    //         toValue: 1,
    //         duration: 2000,
    //         useNativeDriver: true,
    //     }).start();
    // });

    return (
        <>
            <Text numberOfLines={1} style={rowStyles.title}>
                {playlist.title}
            </Text>
            <View style={[rowStyles.container]}>
                <ListComponent
                    contentContainerStyle={rowStyles.listContainer}
                    // See https://shopify.github.io/flash-list/docs/fundamentals/performant-components/#remove-key-prop
                    // keyExtractor={(movie: Movie, index: number) => (isLegend ? movie.id.toString() : index.toString())}
                    // keyExtractor={(movie: Movie, index: number) => index.toString()}
                    ItemSeparatorComponent={MarginBetweenItems}
                    horizontal
                    estimatedItemSize={cardStyles.image.width + 5}
                    data={movies}
                    //   recycleItems
                    renderItem={({ item }: { item: Movie }) => <MoviePortrait movie={item} />}
                    // ref={listRef}
                    //   onMomentumScrollBegin={onMomentumScrollBegin}
                    //   onScroll={onScroll}
                    waitForInitialLayout={false}
                    drawDistance={100}
                    recycleItems={true}
                    useFlashListContainers
                    initialNumContainers={4}
                   
                />
            </View>
        </>
    );
};

const listStyles = StyleSheet.create({
    container: {
        backgroundColor: "black",
        paddingVertical: margins.m,
    },
});

const Movies = ({ isLegend, recycleItems }: { isLegend: boolean; recycleItems?: boolean }) => {
    const playlists = require("../api/data/rows.json");

    const ListComponent = isLegend ? LegendList : FlashList;

    // Flashlist appears to internally multiple the draw distance by 2-3 so increase the draw distance
    // for the Legend version to get the same effect
    const DRAW_DISTANCE = isLegend ? 500 : 250;
    console.log("is legend", isLegend, DRAW_DISTANCE);

    return (
        <>
        <ListComponent
            data={playlists}
            keyExtractor={(playlist: Playlist) => playlist.id}
            estimatedItemSize={cardStyles.image.height + 52}
            renderItem={({ item: playlist, useRecyclingState }: LegendListRenderItemProps<Playlist>) => (
                <MovieRow
                    ListComponent={ListComponent}
                    isLegend={isLegend}
                    playlist={playlist}
                    // useRecyclingState={useRecyclingState}
                    // useRecyclingEffect={useRecyclingEffect}
                />
            )}
            contentContainerStyle={listStyles.container}
            drawDistance={DRAW_DISTANCE}
            waitForInitialLayout={false}
            recycleItems={recycleItems}
            useFlashListContainers
            //SkeletonComponent={SkeletonComponent}
           
        />
        </>
    );
};

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';



const SkeletonComponent = () => {
    return <View style={rowStyles.container}>
    <Text style={rowStyles.title}>Loading...</Text>
        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <Image  style={{...cardStyles.image, margin: 4,backgroundColor: 'grey', flex:1}}   placeholder={{ blurhash }}/>
        <Image  style={{...cardStyles.image, margin: 4, backgroundColor: 'grey', flex:1}} placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}/>
        <Image  style={{...cardStyles.image, margin: 4, backgroundColor: 'grey', flex:1}} placeholder={{ blurhash: 'LKN]Rv%2Tw=w]~RBVZRi};RPxuwH' }}/>
        <Image  style={{...cardStyles.image, margin: 4, backgroundColor: 'grey', flex:1}} placeholder={{ blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.' }}/>
      
    </View>
    </View>
}

export default Movies;
