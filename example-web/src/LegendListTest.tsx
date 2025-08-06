import React from 'react';
import { Text } from '@/platform/Text';
import { View } from '@/platform/View';
// Import the actual LegendList component
import { LegendList } from '@/components/LegendList';

const generateData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    title: `Item ${index + 1}`,
    description: `This is the description for item ${index + 1}. It has some text to make it variable height. ${
      index % 3 === 0 ? 'This item has extra content to demonstrate variable heights in the virtualized list.' : ''
    }`,
    height: Math.floor(Math.random() * 100) + 50, // Random height between 50-150
  }));
};

const LegendListTest: React.FC = () => {
  const data = React.useMemo(() => generateData(1000), []); // More items to show virtualization
  const [scrollY, setScrollY] = React.useState(0);

  const handleScroll = (event: any) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  };

  const renderItem = ({ item, index }: { item: typeof data[0]; index: number }) => (
    <View
      style={{
        padding: 16,
        marginBottom: 8,
        backgroundColor: index % 2 === 0 ? '#f0f0f0' : '#f8f8f8',
        borderRadius: 8,
        minHeight: 80,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
        {item.title}
      </Text>
      <Text style={{ fontSize: 14, color: '#666' }}>
        {item.description}
      </Text>
    </View>
  );

  const keyExtractor = (item: typeof data[0]) => item.id;

  return (
    <View style={{ 
      height: 400, 
      width: '100%', 
      border: '1px solid #ccc',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <View style={{ 
        padding: 16, 
        backgroundColor: '#e0e0e0', 
        borderBottom: '1px solid #ccc',
        flexShrink: 0
      }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
          Legend List Web Test - Scroll Y: {Math.round(scrollY)}
        </Text>
      </View>

      <LegendList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={{ 
          flex: 1,
          height: 340, // 400px container - 60px header
        }}
        onScroll={handleScroll}
        estimatedItemSize={100}
        recycleItems={true}
      />
    </View>
  );
};

export default LegendListTest;