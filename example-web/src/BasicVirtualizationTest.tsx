import React from 'react';

// Create a very basic virtualized list to demonstrate the concept works
const BasicVirtualizationTest: React.FC = () => {
  // Generate a large dataset to test virtualization
  const data = React.useMemo(() => 
    Array.from({ length: 10000 }, (_, index) => ({
      id: `item-${index}`,
      title: `Item ${index + 1}`,
      content: `This is item number ${index + 1} in our virtualized list. ${
        index % 10 === 0 ? 'This item has extra content to show variable heights.' : ''
      }`,
    }))
  , []);

  const [scrollTop, setScrollTop] = React.useState(0);
  const containerHeight = 400;
  const itemHeight = 80;
  const overscan = 5;
  
  // Calculate which items should be visible
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
    data.length - 1
  );

  const visibleItems = data.slice(Math.max(0, startIndex - overscan), endIndex + 1);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const totalHeight = data.length * itemHeight;
  const offsetY = Math.max(0, startIndex - overscan) * itemHeight;

  console.log(`Rendering items ${Math.max(0, startIndex - overscan)} to ${endIndex} (total: ${data.length})`);

  return (
    <div style={{ 
      height: containerHeight, 
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
          Basic Virtualization Test - Showing {visibleItems.length} of {data.length} items
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          Scroll: {scrollTop}px, Items: {Math.max(0, startIndex - overscan)}-{endIndex}
        </div>
      </div>

      <div
        style={{ 
          flex: 1,
          overflow: 'auto',
          position: 'relative'
        }}
        onScroll={handleScroll}
      >
        {/* Total height spacer */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible items container */}
          <div style={{ 
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}>
            {visibleItems.map((item, index) => {
              const actualIndex = Math.max(0, startIndex - overscan) + index;
              return (
                <div
                  key={item.id}
                  style={{
                    height: itemHeight,
                    padding: 16,
                    borderBottom: '1px solid #eee',
                    backgroundColor: actualIndex % 2 === 0 ? '#f9f9f9' : '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 14, color: '#666' }}>
                    {item.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicVirtualizationTest;