import React from 'react';
import { ScrollView } from '@/platform/ScrollView';
import { Text } from '@/platform/Text';
import { View } from '@/platform/View';

const generateData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    title: `Item ${index + 1}`,
    description: `This is the description for item ${index + 1}. It has some text to make it variable height.`,
    height: Math.floor(Math.random() * 100) + 50, // Random height between 50-150
  }));
};

const LegendListTest: React.FC = () => {
  const data = React.useMemo(() => generateData(50), []);
  const [scrollY, setScrollY] = React.useState(0);

  const handleScroll = (event: any) => {
    setScrollY(event.nativeEvent.contentOffset.y);
  };

  const renderItem = ({ item }: { item: typeof data[0] }) => (
    <View
      style={{
        padding: 16,
        marginBottom: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        minHeight: item.height,
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

      <ScrollView
        style={{ 
          flex: 1,
          height: 'calc(100% - 60px)', // Account for header height
          overflow: 'auto'
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {data.map((item) => (
          <View key={item.id}>
            {renderItem({ item })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default LegendListTest;