import * as React from "react";
import { Text, View } from "react-native";

import { IS_DEV } from "@/utils/devEnvironment";

export function DevNumbers() {
    return (
        IS_DEV &&
        React.memo(function DevNumbers() {
            return Array.from({ length: 100 }).map((_, index) => (
                <View
                    key={index}
                    style={{
                        height: 100,
                        pointerEvents: "none",
                        position: "absolute",
                        top: index * 100,
                        width: "100%",
                    }}
                >
                    <Text style={{ color: "red" }}>{index * 100}</Text>
                </View>
            ));
        })
    );
}
