import AllExamples from "./AllExamples";

function App() {
    return (
        <div>
            <h1>Legend List Web Example</h1>

            <div style={{ marginBottom: 32 }}>
                <AllExamples />
            </div>

            {/* Virtual List Comparison now accessible inside AllExamples */}
        </div>
    );
}

export default App;
