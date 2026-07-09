import type {
    DataSourceMutationBatch,
    LegendListArrayDataModeProps,
    LegendListDataMode,
    LegendListDataSource,
    LegendListDataSourceModeProps,
    LegendListProps,
} from "../../src/types.web";

interface Item {
    id: string;
    label: string;
}

type Expect<T extends true> = T;
type IsAssignable<From, To> = From extends To ? true : false;
type Not<T extends boolean> = T extends false ? true : false;

declare const source: LegendListDataSource<Item>;

const arrayMode: LegendListArrayDataModeProps<Item, undefined> = {
    data: [{ id: "a", label: "Alpha" }],
    renderItem: ({ item }) => item.label,
};

const dataSourceMode: LegendListDataSourceModeProps<Item, undefined> = {
    dataSource: source,
    renderItem: ({ dataSource, index, item }) => item?.label ?? `Loading ${dataSource.getKey(index)}`,
};

const dataSourceListProps: LegendListProps<Item, undefined> = dataSourceMode;

const mutationBatch: DataSourceMutationBatch = {
    length: 11,
    operations: [
        { deleteCount: 1, index: 4, insertCount: 2, type: "splice" },
        { count: 1, from: 0, to: 5, type: "move" },
        { count: 3, index: 2, layout: "invalidate", type: "update" },
    ],
    previousLength: 10,
    previousRevision: 2,
    revision: 3,
};

type BothModes = {
    data: readonly Item[];
    dataSource: LegendListDataSource<Item>;
    renderItem: (...args: any[]) => unknown;
};

type MissingModes = {
    renderItem: (...args: any[]) => unknown;
};

type _ArrayModeIsAccepted = Expect<IsAssignable<typeof arrayMode, LegendListDataMode<Item, undefined>>>;
type _DataSourceModeIsAccepted = Expect<IsAssignable<typeof dataSourceMode, LegendListDataMode<Item, undefined>>>;
type _BothModesAreRejected = Expect<Not<IsAssignable<BothModes, LegendListDataMode<Item, undefined>>>>;
type _MissingModesAreRejected = Expect<Not<IsAssignable<MissingModes, LegendListDataMode<Item, undefined>>>>;

void mutationBatch;
void dataSourceListProps;
