# Web DOM Reordering Optimization

## Problem
The current `reorderElementsInDOM` algorithm is inefficient:
1. Rebuilds entire containers array every time
2. Loops through all containers checking if each needs reordering
3. Doesn't leverage knowing which specific item moved
4. Can perform multiple DOM mutations for a single item move

## Optimized Algorithm

### Key Insights
1. When one item moves, we only need ONE DOM mutation (insertBefore)
2. Moving up vs down requires different strategies due to how insertBefore works
3. We need to track current DOM order to know where items currently are
4. InsertBefore automatically handles index shifts - when we insert at position N, everything at N+ shifts right

### Algorithm

```javascript
const reorderElementsInDOM = (element: HTMLDivElement, newPosition: number) => {
    if (Platform.OS !== "web") return;

    const parent = element.parentElement;
    if (!parent) return;

    // Get all positioned containers with their positions
    const containerPositions = Array.from(parent.children)
        .filter((child): child is HTMLDivElement => domOrderingMap.has(child as HTMLDivElement))
        .map((child) => ({
            element: child as HTMLDivElement,
            position: domOrderingMap.get(child as HTMLDivElement)!
        }))
        .sort((a, b) => a.position - b.position);

    // Only reorder if we have multiple containers
    if (containerPositions.length < 2) return;

    // Find where this element should be inserted in the sorted order
    let insertBeforeElement: HTMLDivElement | null = null;
    
    for (const container of containerPositions) {
        if (container.element === element) {
            continue; // Skip the element we're moving
        }
        
        if (container.position > newPosition) {
            insertBeforeElement = container.element;
            break;
        }
    }

    // Check if the element is already in the correct position
    const currentNextSibling = element.nextElementSibling;
    if (currentNextSibling === insertBeforeElement) {
        return; // Already in correct position
    }

    // Perform the DOM reordering
    parent.insertBefore(element, insertBeforeElement);
};
```

### Why This Is Optimal

1. **Single mutation**: Only one `insertBefore` call regardless of list size
2. **Direction-aware**: Automatically handles moving up vs down correctly  
3. **Index-shift aware**: Accounts for the fact that removing an element shifts indices
4. **Early exit**: No DOM mutation if the item is already in the correct position
5. **Leverages insertBefore behavior**: Using `null` as second argument appends to end

### Edge Cases Handled
- Moving to beginning: `referenceElement` becomes first element
- Moving to end: `referenceElement` becomes `null`, appends to end
- Item already in correct position: No DOM mutation occurs
- Single item: Early return, no work needed

### How the Algorithm Works

#### Step-by-Step Breakdown

1. **Collect All Positioned Elements**
   ```javascript
   const containerPositions = Array.from(parent.children)
       .filter((child): child is HTMLDivElement => domOrderingMap.has(child as HTMLDivElement))
       .map((child) => ({
           element: child as HTMLDivElement,
           position: domOrderingMap.get(child as HTMLDivElement)!
       }))
       .sort((a, b) => a.position - b.position);
   ```
   - Gets all child elements that have positions stored in the WeakMap
   - Creates objects pairing each DOM element with its logical position
   - Sorts by logical position to establish the correct order

2. **Find Insertion Point**
   ```javascript
   let insertBeforeElement: HTMLDivElement | null = null;
   
   for (const container of containerPositions) {
       if (container.element === element) {
           continue; // Skip the element we're moving
       }
       
       if (container.position > newPosition) {
           insertBeforeElement = container.element;
           break;
       }
   }
   ```
   - Walks through containers in sorted order
   - Skips the element being moved
   - Finds the first element with position > newPosition
   - This element becomes the "insert before" target

3. **Check if Already Positioned Correctly**
   ```javascript
   const currentNextSibling = element.nextElementSibling;
   if (currentNextSibling === insertBeforeElement) {
       return; // Already in correct position
   }
   ```
   - Compares current next sibling with target insertion point
   - If they match, no DOM mutation needed
   - Early exit prevents unnecessary work

4. **Perform Single DOM Mutation**
   ```javascript
   parent.insertBefore(element, insertBeforeElement);
   ```
   - Single insertBefore call does all the work
   - If insertBeforeElement is null, appends to end
   - DOM automatically handles shifting other elements

#### Edge Cases Handled

- **Moving to Beginning**: First element has position greater than newPosition, so insertBeforeElement becomes first element
- **Moving to End**: No element has position greater than newPosition, so insertBeforeElement remains null (appends to end)
- **Already in Position**: nextElementSibling check prevents unnecessary mutations
- **Single Element**: Early return when containerPositions.length < 2

#### Performance Benefits

- **O(n) complexity**: Single pass through containers to find insertion point
- **Single DOM mutation**: Only one insertBefore operation regardless of list size
- **Early exit optimization**: Skips work when element already positioned correctly
- **No index calculations**: Avoids complex array index math and adjustments

### Implementation Notes
- Replace the current `reorderElementsInDOM` function with this optimized version
- Keep the same WeakMap caching strategy (`domOrderingMap`)
- Maintain the same calling pattern from useLayoutEffect