import React from 'react';

// For now, let's create a simple test that tries to import LegendList
// and see what breaks
const SimpleLegendListTest: React.FC = () => {
  const data = React.useMemo(() => 
    Array.from({ length: 50 }, (_, index) => ({
      id: `item-${index}`,
      title: `Item ${index + 1}`,
      description: `Description for item ${index + 1}`,
    }))
  , []);

  const renderItem = ({ item }: { item: typeof data[0] }) => (
    <div
      style={{
        padding: 16,
        marginBottom: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        minHeight: 60,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
        {item.title}
      </div>
      <div style={{ fontSize: 14, color: '#666' }}>
        {item.description}
      </div>
    </div>
  );

  return (
    <div style={{ 
      height: 400, 
      width: '100%', 
      border: '1px solid #ccc',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        padding: 16, 
        backgroundColor: '#e0e0e0', 
        borderBottom: '1px solid #ccc',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 18, fontWeight: 'bold' }}>
          Simple Legend List Web Test
        </div>
      </div>

      <div
        style={{ 
          flex: 1,
          height: 'calc(100% - 60px)', // Account for header height
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {data.map((item) => (
          <div key={item.id}>
            {renderItem({ item })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimpleLegendListTest;