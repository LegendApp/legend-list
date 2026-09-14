import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { DemoTabs } from "~/components/DemoTabs";
import { OptimizationDataDemo } from "~/screens/examples/optimization/OptimizationDataDemo";
import { OptimizationIdentitiesDemo } from "~/screens/examples/optimization/OptimizationIdentitiesDemo";
import { OptimizationInvalidationDemo } from "~/screens/examples/optimization/OptimizationInvalidationDemo";
import { OptimizationRecyclingDemo } from "~/screens/examples/optimization/OptimizationRecyclingDemo";
import {
    getOptimizationDemo,
    OPTIMIZATION_DEMOS,
    type OptimizationDemoId,
} from "~/screens/examples/optimizationConfig";

function OptimizationContent({ demoId }: { demoId: OptimizationDemoId }) {
    let content = <OptimizationIdentitiesDemo />;

    if (demoId === "invalidation") {
        content = <OptimizationInvalidationDemo />;
    } else if (demoId === "recycling") {
        content = <OptimizationRecyclingDemo />;
    } else if (demoId === "data") {
        content = <OptimizationDataDemo />;
    }

    return content;
}

export function OptimizationExample() {
    const router = useRouter();
    const params = useLocalSearchParams<{ demo?: string | string[] }>();
    const demo = getOptimizationDemo(params.demo);

    return (
        <View style={styles.container}>
            <DemoTabs
                onSelect={(demoId) => router.setParams({ demo: demoId })}
                selectedId={demo.id}
                tabs={OPTIMIZATION_DEMOS}
            />
            <View key={demo.id} style={styles.content}>
                <OptimizationContent demoId={demo.id} />
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
