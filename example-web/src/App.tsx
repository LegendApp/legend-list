import SimpleLegendListTest from './SimpleLegendListTest'
import BasicVirtualizationTest from './BasicVirtualizationTest'
import MinimalLegendListTest from './MinimalLegendListTest'

function App() {
  return (
    <div>
      <h1>Legend List Web Example</h1>
      
      <div style={{ marginBottom: 32 }}>
        <h2>Platform Abstractions Status</h2>
        <MinimalLegendListTest />
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2>Basic Virtualization Demo</h2>
        <p style={{ fontSize: 14, color: '#666' }}>
          This demonstrates that virtualization works on web - only rendering visible items from 10,000 total items.
        </p>
        <BasicVirtualizationTest />
      </div>
      
      <div>
        <h2>Simple Static List</h2>
        <SimpleLegendListTest />
      </div>
    </div>
  )
}

export default App