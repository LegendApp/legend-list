/**
 * @generated SignedSource<<2fed62b967f1107de126b7ca5aaf4bf2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type LegendListRelayWarningTest_ConversationQuery$variables = Record<PropertyKey, never>;
export type LegendListRelayWarningTest_ConversationQuery$data = {
  readonly conversation: {
    readonly feed: {
      readonly __id: string;
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly __typename: "Message";
          readonly id: string;
          readonly " $fragmentSpreads": FragmentRefs<"LegendListRelayWarningTest_messageRowFragment">;
        };
      }>;
    };
    readonly id: string;
  };
};
export type LegendListRelayWarningTest_ConversationQuery = {
  response: LegendListRelayWarningTest_ConversationQuery$data;
  variables: LegendListRelayWarningTest_ConversationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "PageInfo",
  "kind": "LinkedField",
  "name": "pageInfo",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasPreviousPage",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "startCursor",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v4 = {
  "kind": "ClientExtension",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "__id",
      "storageKey": null
    }
  ]
},
v5 = [
  {
    "kind": "Literal",
    "name": "last",
    "value": 20
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "LegendListRelayWarningTest_ConversationQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Conversation",
        "kind": "LinkedField",
        "name": "conversation",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": "feed",
            "args": null,
            "concreteType": "MessageConnection",
            "kind": "LinkedField",
            "name": "__Conversation_feed_connection",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "MessageEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Message",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v0/*: any*/),
                      (v1/*: any*/),
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "LegendListRelayWarningTest_messageRowFragment"
                      }
                    ],
                    "storageKey": null
                  },
                  (v2/*: any*/)
                ],
                "storageKey": null
              },
              (v3/*: any*/),
              (v4/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "LegendListRelayWarningTest_ConversationQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Conversation",
        "kind": "LinkedField",
        "name": "conversation",
        "plural": false,
        "selections": [
          (v0/*: any*/),
          {
            "alias": null,
            "args": (v5/*: any*/),
            "concreteType": "MessageConnection",
            "kind": "LinkedField",
            "name": "feed",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "MessageEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Message",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v0/*: any*/),
                      (v1/*: any*/),
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
                  (v2/*: any*/)
                ],
                "storageKey": null
              },
              (v3/*: any*/),
              (v4/*: any*/)
            ],
            "storageKey": "feed(last:20)"
          },
          {
            "alias": null,
            "args": (v5/*: any*/),
            "filters": null,
            "handle": "connection",
            "key": "Conversation_feed",
            "kind": "LinkedHandle",
            "name": "feed"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3c6def6c4821a5f9bacf723b0486d33a",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "backward",
          "path": [
            "conversation",
            "feed"
          ]
        }
      ]
    },
    "name": "LegendListRelayWarningTest_ConversationQuery",
    "operationKind": "query",
    "text": "query LegendListRelayWarningTest_ConversationQuery {\n  conversation {\n    id\n    feed(last: 20) {\n      edges {\n        node {\n          id\n          __typename\n          ...LegendListRelayWarningTest_messageRowFragment\n        }\n        cursor\n      }\n      pageInfo {\n        hasPreviousPage\n        startCursor\n      }\n    }\n  }\n}\n\nfragment LegendListRelayWarningTest_messageRowFragment on Message {\n  id\n  text\n  createdAt\n}\n"
  }
};
})();

(node as any).hash = "fef9b0ee6a13367c37af04827b44bd47";

export default node;
