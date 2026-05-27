import * as React from "react";

import type { LegendListDataset, LegendListDatasetsProps, LegendListProps } from "@/react-native";
import { LegendList, LegendListDatasets } from "@/react-native";

type Item = { id: string };

type ReactNativeScrollPassthroughProp =
    | "bounces"
    | "directionalLockEnabled"
    | "keyboardShouldPersistTaps"
    | "nestedScrollEnabled"
    | "overScrollMode"
    | "scrollEventThrottle"
    | "showsHorizontalScrollIndicator"
    | "showsVerticalScrollIndicator";

type AssertNever<T extends never> = T;
type MissingLegendListPassthroughProps = Exclude<ReactNativeScrollPassthroughProp, keyof LegendListProps<Item>>;
type MissingLegendListDatasetsPassthroughProps = Exclude<
    ReactNativeScrollPassthroughProp,
    keyof LegendListDatasetsProps<Item>
>;
type IntentionalLegendListDatasetsPropDifferences =
    | "children"
    | "data"
    | "getEstimatedItemSize"
    | "getFixedItemSize"
    | "getItemType"
    | "keyExtractor"
    | "renderItem";
type MissingSharedLegendListProps = Exclude<
    keyof LegendListProps<Item>,
    keyof LegendListDatasetsProps<Item> | IntentionalLegendListDatasetsPropDifferences
>;

export type AssertLegendListHasReactNativeScrollPassthroughProps = AssertNever<MissingLegendListPassthroughProps>;
export type AssertLegendListDatasetsHasReactNativeScrollPassthroughProps =
    AssertNever<MissingLegendListDatasetsPassthroughProps>;
export type AssertLegendListDatasetsHasSharedLegendListProps = AssertNever<MissingSharedLegendListProps>;

const data: Item[] = [{ id: "1" }];
const datasets: LegendListDataset<Item>[] = [{ data, key: "primary" }];

export const legendListAcceptsReactNativeScrollPassthroughProps = (
    <LegendList
        bounces
        data={data}
        directionalLockEnabled
        keyboardShouldPersistTaps="always"
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        overScrollMode="never"
        renderItem={() => null}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
    />
);

export const legendListDatasetsAcceptsReactNativeScrollPassthroughProps = (
    <LegendListDatasets
        activeDatasetKey="primary"
        bounces
        contentContainerStyle={{ paddingBottom: 16 }}
        datasets={datasets}
        directionalLockEnabled
        inactiveDatasetBehavior="hide"
        keyboardShouldPersistTaps="always"
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        overScrollMode="never"
        renderItem={() => null}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
    />
);

export const legendListDatasetsRejectsActiveKey: LegendListDatasetsProps<Item> = {
    activeDatasetKey: "primary",
    // @ts-expect-error activeKey is not part of the LegendListDatasets v3 API.
    activeKey: "primary",
    datasets,
    keyExtractor: (item) => item.id,
    renderItem: () => null,
};

export const legendListDatasetsRejectsInactiveBehavior: LegendListDatasetsProps<Item> = {
    activeDatasetKey: "primary",
    datasets,
    // @ts-expect-error inactiveBehavior is not part of the LegendListDatasets v3 API.
    inactiveBehavior: "hide",
    keyExtractor: (item) => item.id,
    renderItem: () => null,
};

export const reactNativeDatasetsPropElements = React.createElement(
    React.Fragment,
    null,
    legendListAcceptsReactNativeScrollPassthroughProps,
    legendListDatasetsAcceptsReactNativeScrollPassthroughProps,
);
