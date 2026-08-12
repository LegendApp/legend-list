import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { DemoTabs } from "~/components/DemoTabs";
import { DebuggingImagesDemo } from "~/screens/examples/debugging/DebuggingImagesDemo";
import { DebuggingRenderWindowDemo } from "~/screens/examples/debugging/DebuggingRenderWindowDemo";
import { DebuggingRowCostDemo } from "~/screens/examples/debugging/DebuggingRowCostDemo";
import { DEBUGGING_DEMOS, type DebuggingDemoId, getDebuggingDemo } from "~/screens/examples/debuggingConfig";

function DebuggingContent({ demoId }: { demoId: DebuggingDemoId }) {
    let content = <DebuggingRowCostDemo />;

    if (demoId === "render-window") {
        content = <DebuggingRenderWindowDemo />;
    } else if (demoId === "images") {
        content = <DebuggingImagesDemo />;
    }

    return content;
}

export function DebuggingExample() {
    const router = useRouter();
    const params = useLocalSearchParams<{ demo?: string | string[] }>();
    const demo = getDebuggingDemo(params.demo);

    return (
        <View style={styles.container}>
            <DemoTabs
                onSelect={(demoId) => router.setParams({ demo: demoId })}
                selectedId={demo.id}
                tabs={DEBUGGING_DEMOS}
            />
            <View key={demo.id} style={styles.content}>
                <DebuggingContent demoId={demo.id} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: "#F8FAFC",
        flex: 1,
    },
    content: {
        flex: 1,
    },
});
