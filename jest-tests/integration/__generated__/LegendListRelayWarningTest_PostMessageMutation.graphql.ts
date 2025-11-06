/**
 * @generated SignedSource<<7e6a5abaee04d206f11f56adce2ee72f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PostMessageInput = {
  text: string;
};
export type LegendListRelayWarningTest_PostMessageMutation$variables = {
  connections: ReadonlyArray<string>;
  input: PostMessageInput;
};
export type LegendListRelayWarningTest_PostMessageMutation$data = {
  readonly postMessage: {
    readonly message: {
      readonly __typename: "Message";
      readonly id: string;
      readonly " $fragmentSpreads": FragmentRefs<"LegendListRelayWarningTest_messageRowFragment">;
    };
  };
};
export type LegendListRelayWarningTest_PostMessageMutation$rawResponse = {
  readonly postMessage: {
    readonly message: {
      readonly __typename: "Message";
      readonly createdAt: string;
      readonly id: string;
      readonly text: string;
    };
  };
};
export type LegendListRelayWarningTest_PostMessageMutation = {
  rawResponse: LegendListRelayWarningTest_PostMessageMutation$rawResponse;
  response: LegendListRelayWarningTest_PostMessageMutation$data;
  variables: LegendListRelayWarningTest_PostMessageMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "LegendListRelayWarningTest_PostMessageMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PostMessagePayload",
        "kind": "LinkedField",
        "name": "postMessage",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Message",
            "kind": "LinkedField",
            "name": "message",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "LegendListRelayWarningTest_messageRowFragment"
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "LegendListRelayWarningTest_PostMessageMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "PostMessagePayload",
        "kind": "LinkedField",
        "name": "postMessage",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Message",
            "kind": "LinkedField",
            "name": "message",
            "plural": false,
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
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
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "appendNode",
            "key": "",
            "kind": "LinkedHandle",
            "name": "message",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              },
              {
                "kind": "Literal",
                "name": "edgeTypeName",
                "value": "MessageEdge"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ee59d08385df83989a5331712c20e729",
    "id": null,
    "metadata": {},
    "name": "LegendListRelayWarningTest_PostMessageMutation",
    "operationKind": "mutation",
    "text": "mutation LegendListRelayWarningTest_PostMessageMutation(\n  $input: PostMessageInput!\n) {\n  postMessage(input: $input) {\n    message {\n      id\n      __typename\n      ...LegendListRelayWarningTest_messageRowFragment\n    }\n  }\n}\n\nfragment LegendListRelayWarningTest_messageRowFragment on Message {\n  id\n  text\n  createdAt\n}\n"
  }
};
})();

(node as any).hash = "05f6e4cf8737311a8459306e1ba44f03";

export default node;
