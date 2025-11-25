import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  Dimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withSpring,
  useDerivedValue,
  interpolate,
  useAnimatedReaction,
  cancelAnimation,
} from 'react-native-reanimated';
import { LegendList } from '@legendapp/list';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_HEIGHT = 80;
const ITEM_MARGIN = 10;
const CONTAINER_PADDING = 20;
// Reduce item width significantly to accommodate scale animation and padding
const SCALE_FACTOR = 1.02;
const ITEM_WIDTH = SCREEN_WIDTH - (CONTAINER_PADDING * 2) - 20; // Extra 20px margin for scale

interface SortableItem {
  id: string;
  title: string;
  color: string;
}

const initialData: SortableItem[] = [
  { id: '1', title: 'Apple 🍎', color: '#FF6B6B' },
  { id: '2', title: 'Banana 🍌', color: '#4ECDC4' },
  { id: '3', title: 'Orange 🍊', color: '#45B7D1' },
  { id: '4', title: 'Grape 🍇', color: '#96CEB4' },
  { id: '5', title: 'Strawberry 🍓', color: '#FFEAA7' },
  { id: '6', title: 'Blueberry 🫐', color: '#DDA0DD' },
  { id: '7', title: 'Pineapple 🍍', color: '#98D8C8' },
  { id: '8', title: 'Watermelon 🍉', color: '#F7DC6F' },
];

interface SortableItemProps {
  item: SortableItem;
  index: number;
  onDragStart: () => void;
  onDragEnd: (data: SortableItem[]) => void;
  draggedItemId: Animated.SharedValue<string | null>;
  positions: Animated.SharedValue<{ [key: string]: number }>;
  data: SortableItem[];
}

const SortableItemComponent: React.FC<SortableItemProps> = ({
  item,
  index,
  onDragStart,
  onDragEnd,
  draggedItemId,
  positions,
  data,
}) => {
  const ITEM_SIZE = ITEM_HEIGHT + ITEM_MARGIN;
  
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.1);
  
  // Track if this specific item is being dragged
  const isDragging = useDerivedValue(() => draggedItemId.value === item.id);
  
  // Get this item's current position from the positions object
  const itemPosition = useDerivedValue(() => {
    return positions.value[item.id] ?? index;
  });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      // Cancel any ongoing animations
      cancelAnimation(translateY);
      cancelAnimation(scale);
      cancelAnimation(shadowOpacity);
      
      // Mark this item as being dragged
      draggedItemId.value = item.id;
      
      // Start drag animations with gentler scaling
      scale.value = withSpring(1.02, { damping: 20, stiffness: 250 });
      shadowOpacity.value = withSpring(0.25, { damping: 20, stiffness: 250 });
      
      runOnJS(onDragStart)();
    })
    .onUpdate((event: any) => {
      // Update translation for the dragged item
      translateY.value = event.translationY;
      
      // Calculate the absolute Y position of the dragged item
      const currentY = index * ITEM_SIZE + event.translationY;
      
      // Determine which position this item should be at
      const newPosition = Math.round(currentY / ITEM_SIZE);
      const clampedPosition = Math.max(0, Math.min(data.length - 1, newPosition));
      
      // Only update if the position actually changed
      const currentPosition = positions.value[item.id];
      if (clampedPosition !== currentPosition) {
        // Create new positions object
        const newPositions = { ...positions.value };
        
        // Move other items out of the way
        Object.keys(newPositions).forEach(itemId => {
          if (itemId === item.id) return;
          
          const otherPosition = newPositions[itemId];
          
          if (clampedPosition > currentPosition) {
            // Moving down: items in between move up
            if (otherPosition > currentPosition && otherPosition <= clampedPosition) {
              newPositions[itemId] = otherPosition - 1;
            }
          } else {
            // Moving up: items in between move down
            if (otherPosition < currentPosition && otherPosition >= clampedPosition) {
              newPositions[itemId] = otherPosition + 1;
            }
          }
        });
        
        // Set the dragged item's new position
        newPositions[item.id] = clampedPosition;
        positions.value = newPositions;
      }
    })
    .onEnd(() => {
      // Get final position
      const finalPosition = positions.value[item.id];
      
      // Reset drag animations with less bounce
      translateY.value = withSpring(0, { damping: 25, stiffness: 180 });
      scale.value = withSpring(1, { damping: 25, stiffness: 180 });
      shadowOpacity.value = withSpring(0.1, { damping: 25, stiffness: 180 });
      
      // Clear dragged item
      draggedItemId.value = null;
      
      // Update data if position changed
      if (finalPosition !== index) {
        // Create new data array based on positions
        const sortedItems = Object.keys(positions.value)
          .map(itemId => ({
            itemId,
            position: positions.value[itemId],
            item: data.find(d => d.id === itemId)!
          }))
          .sort((a, b) => a.position - b.position)
          .map(({ item }) => item);
        
        runOnJS(onDragEnd)(sortedItems);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    // Calculate target Y position based on the item's position
    const targetY = itemPosition.value * ITEM_SIZE - index * ITEM_SIZE;
    
    return {
      transform: [
        {
          translateY: isDragging.value 
            ? translateY.value 
            : withSpring(targetY, { damping: 25, stiffness: 200 }),
        },
        {
          scale: scale.value,
        },
      ],
      zIndex: isDragging.value ? 1000 : 1,
      elevation: isDragging.value ? 10 : 2,
    };
  });

  const shadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: shadowOpacity.value,
  }));

  const opacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scale.value,
      [1, 1.02],
      [1, 0.98]
    ),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.itemContainer, animatedStyle]}>
        <Animated.View style={[styles.item, { backgroundColor: item.color }, shadowStyle, opacityStyle]}>
          <View style={styles.dragHandle}>
            <View style={styles.dragLine} />
            <View style={styles.dragLine} />
            <View style={styles.dragLine} />
          </View>
          <Text style={styles.itemText}>{item.title}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

export default function SortableList() {
  const [data, setData] = useState<SortableItem[]>(initialData);
  const draggedItemId = useSharedValue<string | null>(null);
  
  // Track positions for each item by ID
  const positions = useSharedValue(
    data.reduce((acc, item, index) => {
      acc[item.id] = index;
      return acc;
    }, {} as { [key: string]: number })
  );

  // React to data changes and update positions
  useAnimatedReaction(
    () => data.length,
    (currentLength, previousLength) => {
      if (currentLength !== previousLength) {
        // Reset positions when data changes
        const newPositions: { [key: string]: number } = {};
        data.forEach((item, index) => {
          newPositions[item.id] = index;
        });
        positions.value = newPositions;
      }
    },
    [data]
  );

  const onDragStart = useCallback(() => {
    console.log('Drag started');
  }, []);

  const onDragEnd = useCallback((newData: SortableItem[]) => {
    console.log('Drag ended, new order:', newData.map(item => item.title));
    setData(newData);
    
    // Update positions to match new data order
    const newPositions: { [key: string]: number } = {};
    newData.forEach((item, index) => {
      newPositions[item.id] = index;
    });
    positions.value = newPositions;
  }, [positions]);

  const renderItem = useCallback(({ item, index }: { item: SortableItem; index: number }) => {
    return (
      <SortableItemComponent
        item={item}
        index={index}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        draggedItemId={draggedItemId}
        positions={positions}
        data={data}
      />
    );
  }, [onDragStart, onDragEnd, draggedItemId, positions, data]);

  const showCurrentOrder = () => {
    const orderText = data.map((item, index) => `${index + 1}. ${item.title}`).join('\n');
    Alert.alert('Current Order', orderText);
  };

  const resetOrder = () => {
    setData(initialData);
    const resetPositions = initialData.reduce((acc, item, index) => {
      acc[item.id] = index;
      return acc;
    }, {} as { [key: string]: number });
    positions.value = resetPositions;
  };

  const shuffleItems = () => {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    setData(shuffled);
    const resetPositions = shuffled.reduce((acc, item, index) => {
      acc[item.id] = index;
      return acc;
    }, {} as { [key: string]: number });
    positions.value = resetPositions;
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sortable List</Text>
        <Text style={styles.subtitle}>Rock-solid drag and drop implementation</Text>
        
        <View style={styles.buttonContainer}>
          <Pressable style={styles.button} onPress={showCurrentOrder}>
            <Text style={styles.buttonText}>Show Order</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={shuffleItems}>
            <Text style={styles.buttonText}>Shuffle</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={resetOrder}>
            <Text style={styles.buttonText}>Reset</Text>
          </Pressable>
        </View>
      </View>
      
      <View style={styles.listContainer}>
        <LegendList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={ITEM_HEIGHT + ITEM_MARGIN}
          scrollEnabled={draggedItemId.value === null}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 20,
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    height: ITEM_HEIGHT,
    marginBottom: ITEM_MARGIN,
    width: '100%',
    alignItems: 'center', // Center the item within container
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
  },
  dragHandle: {
    marginRight: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dragLine: {
    width: 18,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginVertical: 1,
    borderRadius: 1,
  },
  itemText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    flex: 1,
  },
});