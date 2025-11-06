import React, { act, Suspense, useEffect, useMemo, useRef } from "react";
import { FlatList, Text } from "react-native";
import { graphql, RelayEnvironmentProvider, useFragment, useLazyLoadQuery, useMutation } from "react-relay";
import TestRenderer from "react-test-renderer";

import { LegendList } from "@/components/LegendList";
import { describe, expect, it, jest } from "@jest/globals";
import {
    ConnectionHandler,
    Environment,
    type GraphQLResponse,
    Network,
    Observable,
    RecordSource,
    Store,
} from "relay-runtime";
import type {
    LegendListRelayWarningTest_ConversationQuery,
    LegendListRelayWarningTest_ConversationQuery$data,
} from "./__generated__/LegendListRelayWarningTest_ConversationQuery.graphql";
import type {
    LegendListRelayWarningTest_messageRowFragment$data,
    LegendListRelayWarningTest_messageRowFragment$key,
} from "./__generated__/LegendListRelayWarningTest_messageRowFragment.graphql";
import type { LegendListRelayWarningTest_PostMessageMutation } from "./__generated__/LegendListRelayWarningTest_PostMessageMutation.graphql";

type MessageNode = NonNullable<
    LegendListRelayWarningTest_ConversationQuery$data["conversation"]
>["feed"]["edges"][number]["node"];

interface PendingMutation {
    sink: {
        next: (response: GraphQLResponse) => void;
        complete: () => void;
    };
    variables: Record<string, unknown>;
}

const conversationId = "conversation-1";
const connectionKey = "Conversation_feed";
const connectionId = ConnectionHandler.getConnectionID(conversationId, connectionKey);

const SEED_MESSAGE: LegendListRelayWarningTest_messageRowFragment$data = {
    " $fragmentType": "LegendListRelayWarningTest_messageRowFragment",
    createdAt: "2024-01-01T10:00:00.000Z",
    id: "message-seed",
    text: "Initial message already in the feed",
};

const OPTIMISTIC_MESSAGE: LegendListRelayWarningTest_messageRowFragment$data = {
    " $fragmentType": "LegendListRelayWarningTest_messageRowFragment",
    createdAt: "2024-01-01T10:01:00.000Z",
    id: "optimistic-message",
    text: "Delivered optimistically",
};

const SERVER_MESSAGE: LegendListRelayWarningTest_messageRowFragment$data = {
    " $fragmentType": "LegendListRelayWarningTest_messageRowFragment",
    createdAt: OPTIMISTIC_MESSAGE.createdAt,
    id: "server-message",
    text: OPTIMISTIC_MESSAGE.text,
};

const RELAY_WARNING_FRAGMENT_TEXT = "Relay: Expected to have been able to read non-null data for fragment";

const legendListQuery = graphql`
    query LegendListRelayWarningTest_ConversationQuery {
        conversation {
            id
            feed(last: 20) @connection(key: "Conversation_feed") {
                __id
                edges {
                    node {
                        id
                        __typename
                        ...LegendListRelayWarningTest_messageRowFragment
                    }
                }
            }
        }
    }
`;

const messageRowFragment = graphql`
    fragment LegendListRelayWarningTest_messageRowFragment on Message {
        id
        text
        createdAt
    }
`;

const postMessageMutation = graphql`
    mutation LegendListRelayWarningTest_PostMessageMutation($input: PostMessageInput!, $connections: [ID!]!) @raw_response_type {
        postMessage(input: $input) {
            message @appendNode(edgeTypeName: "MessageEdge", connections: $connections) {
                id
                __typename
                ...LegendListRelayWarningTest_messageRowFragment
            }
        }
    }
`;

function createInitialQueryPayload(): GraphQLResponse {
    return {
        data: {
            conversation: {
                feed: {
                    __id: connectionId,
                    edges: [
                        {
                            cursor: "cursor-initial",
                            node: { ...SEED_MESSAGE },
                        },
                    ],
                    pageInfo: {
                        hasPreviousPage: false,
                        startCursor: "cursor-initial",
                    },
                },
                id: conversationId,
            },
        },
    };
}

function createServerMutationPayload(): GraphQLResponse {
    return {
        data: {
            postMessage: {
                message: { ...SERVER_MESSAGE },
            },
        },
    };
}

function createEnvironment(onMutationStart: (pending: PendingMutation) => void) {
    const network = Network.create((operation, variables) =>
        Observable.create<GraphQLResponse>((sink) => {
            if (operation.operationKind === "query") {
                sink.next(createInitialQueryPayload());
                sink.complete();
                return () => {};
            }

            if (operation.operationKind === "mutation") {
                const pending = {
                    sink: {
                        complete: () => sink.complete(),
                        next: (response: GraphQLResponse) => sink.next(response),
                    },
                    variables,
                };
                onMutationStart(pending);
                return () => {};
            }

            sink.complete();
            return () => {};
        }),
    );

    return new Environment({
        network,
        store: new Store(new RecordSource()),
    });
}

function MessageRow({
    fragmentRef,
    index,
}: {
    fragmentRef: LegendListRelayWarningTest_messageRowFragment$key;
    index: number;
}) {
    const data = useFragment(messageRowFragment, fragmentRef);

    if (!data) {
        return null;
    }

    return <Text>{`${index + 1}. ${data.text}`}</Text>;
}

type ListType = "FlatList" | "LegendList";

interface HarnessConfig {
    listType: ListType;
}

function createRelayListHarness(config: HarnessConfig) {
    return function RelayListHarness() {
        const data = useLazyLoadQuery<LegendListRelayWarningTest_ConversationQuery>(legendListQuery, {});
        const [commit] = useMutation<LegendListRelayWarningTest_PostMessageMutation>(postMessageMutation);
        const hasCommitted = useRef(false);

        const messages = useMemo(
            () => data.conversation.feed.edges.map((edge) => edge?.node).filter(Boolean),
            [data.conversation.feed.edges],
        );

        const connectionIdentifier = data.conversation.feed.__id;

        useEffect(() => {
            if (!connectionIdentifier || hasCommitted.current) {
                return;
            }

            hasCommitted.current = true;
            commit({
                optimisticResponse: {
                    postMessage: {
                        message: { ...OPTIMISTIC_MESSAGE, __typename: "Message" },
                    },
                },
                variables: {
                    connections: [connectionIdentifier],
                    input: {
                        text: OPTIMISTIC_MESSAGE.text,
                    },
                },
            });
        }, [commit, connectionIdentifier]);

        if (config.listType === "FlatList") {
            return (
                <FlatList
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }: { item: MessageNode; index: number }) => (
                        <MessageRow fragmentRef={item} index={index} />
                    )}
                />
            );
        }

        return (
            <LegendList
                data={messages}
                estimatedItemSize={72}
                keyExtractor={(item) => item.id}
                recycleItems
                renderItem={({ item, index }: { item: MessageNode; index: number }) => (
                    <MessageRow fragmentRef={item} index={index} />
                )}
            />
        );
    };
}

function createTestSuite(listType: ListType) {
    describe(`${listType} + Relay optimistic updates`, () => {
        it("should not log Relay warnings when handling optimistic updates", async () => {
            let pendingMutation: PendingMutation | null = null;
            const environment = createEnvironment((pending) => {
                pendingMutation = pending;
            });

            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            const RelayListHarness = createRelayListHarness({ listType });

            let renderer: ReturnType<typeof TestRenderer.create> | null = null;
            await act(async () => {
                renderer = TestRenderer.create(
                    <RelayEnvironmentProvider environment={environment}>
                        <Suspense fallback={null}>
                            <RelayListHarness />
                        </Suspense>
                    </RelayEnvironmentProvider>,
                );
            });

            if (!renderer) {
                throw new Error("Failed to mount test renderer");
            }

            const waitForCondition = async (predicate: () => boolean, timeoutMs = 2_000) => {
                const deadline = Date.now() + timeoutMs;
                while (Date.now() < deadline) {
                    if (predicate()) {
                        return;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }

                throw new Error("Timed out waiting for condition to be satisfied");
            };

            const hasRelayWarning = () =>
                consoleErrorSpy.mock.calls.some((args: any[]) =>
                    args
                        .filter((arg: any): arg is string => typeof arg === "string")
                        .some(
                            (message: string) =>
                                message.includes(RELAY_WARNING_FRAGMENT_TEXT) && message.includes("messageRowFragment"),
                        ),
                );

            try {
                await waitForCondition(() => pendingMutation !== null);

                await act(async () => {
                    pendingMutation!.sink.next(createServerMutationPayload());
                    pendingMutation!.sink.complete();
                });

                // Give React time to process the update and potentially log warnings
                await new Promise((resolve) => setTimeout(resolve, 100));

                // Both list types should NOT log warnings - this will show LegendList is failing
                expect(hasRelayWarning()).toBe(false);
            } finally {
                consoleErrorSpy.mockRestore();
                if (renderer) {
                    await act(async () => {
                        renderer!.unmount();
                    });
                }
            }
        });
    });
}

// Test both list implementations
createTestSuite("FlatList");
createTestSuite("LegendList");
