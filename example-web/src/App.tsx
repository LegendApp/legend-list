import LegendListTest from './LegendListTest'

function App() {
  return (
    <div>
      <h1>Legend List Web Example</h1>
      
      <div style={{ marginBottom: 32 }}>
        <h2>LegendList Virtualization Test</h2>
        <p style={{ fontSize: 14, color: '#666' }}>
          Testing the actual LegendList component with virtualization on web.
        </p>
        <LegendListTest />
      </div>
    </div>
  )
}

export default App