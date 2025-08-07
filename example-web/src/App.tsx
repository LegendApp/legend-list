import LegendListTest from "./LegendListTest";
import VirtualListComparison from "./VirtualListComparison";

function App() {
    return (
        <div>
            <h1>Legend List Web Example</h1>

            {/* <div style={{ marginBottom: 32 }}>
                <h2>LegendList Virtualization Test</h2>
                <p style={{ color: "#666", fontSize: 14 }}>
                    Testing the actual LegendList component with virtualization on web.
                </p>
                <LegendListTest />
            </div> */}

            <div style={{ marginBottom: 32 }}>
                <h2>Virtual List Comparison</h2>
                <p style={{ color: "#666", fontSize: 14 }}>
                    Comparing LegendList, virtua, and react-virtuoso rendering the same data.
                </p>
                <VirtualListComparison />
            </div>
        </div>
    );
}

export default App;
