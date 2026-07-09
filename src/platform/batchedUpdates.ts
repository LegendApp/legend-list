import * as ReactDOM from "react-dom";

type Batch = (fn: () => void) => void;

const unstableBatchedUpdates = (ReactDOM as { unstable_batchedUpdates?: Batch }).unstable_batchedUpdates;

export const batchedUpdates: Batch =
    typeof unstableBatchedUpdates === "function" ? unstableBatchedUpdates : (fn) => fn();
