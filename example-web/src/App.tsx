import React from 'react'
import LegendListTest from './LegendListTest'
import SimpleLegendListTest from './SimpleLegendListTest'

function App() {
  return (
    <div>
      <h1>Legend List Web Example</h1>
      <div style={{ marginBottom: 32 }}>
        <h2>Platform Abstractions Test</h2>
        <LegendListTest />
      </div>
      <div>
        <h2>Simple Static List</h2>
        <SimpleLegendListTest />
      </div>
    </div>
  )
}

export default App