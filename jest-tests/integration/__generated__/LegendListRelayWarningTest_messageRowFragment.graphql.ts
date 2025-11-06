/**
 * @generated SignedSource<<c4a1d0288c6a920baf28cc2455c4a5f8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LegendListRelayWarningTest_messageRowFragment$data = {
  readonly createdAt: string;
  readonly id: string;
  readonly text: string;
  readonly " $fragmentType": "LegendListRelayWarningTest_messageRowFragment";
};
export type LegendListRelayWarningTest_messageRowFragment$key = {
  readonly " $data"?: LegendListRelayWarningTest_messageRowFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"LegendListRelayWarningTest_messageRowFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "LegendListRelayWarningTest_messageRowFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "text",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    }
  ],
  "type": "Message",
  "abstractKey": null
};

(node as any).hash = "ad5e9e5b3479acf674a7c9ddcea1e449";

export default node;
