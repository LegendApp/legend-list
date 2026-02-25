import * as ReactNative from "react-native";

type Batch = (fn: () => void) => void;

const unstableBatchedUpdates = (ReactNative as { unstable_batchedUpdates?: Batch }).unstable_batchedUpdates;

export const batchedUpdates: Batch =
    typeof unstableBatchedUpdates === "function" ? unstableBatchedUpdates : (fn) => fn();
