import { Order, OrderItem, TimelineEntry, OrderFile } from '@/types/order';

/**
 * Merge order updates into existing order state
 * Handles partial updates without losing existing data
 */
export function mergeOrderUpdate(
  currentOrder: Order,
  updates: Partial<Order>
): Order {
  return {
    ...currentOrder,
    ...updates,
    // Preserve nested objects if not fully updated
    customer: updates.customer ? { ...currentOrder.customer, ...updates.customer } : currentOrder.customer,
    items: currentOrder.items, // Items are updated separately via mergeItemUpdate
    meta: updates.meta ? { ...currentOrder.meta, ...updates.meta } : currentOrder.meta,
  };
}

/**
 * Merge item updates into existing item state
 */
export function mergeItemUpdate(
  currentItems: OrderItem[],
  itemId: string,
  updates: Partial<OrderItem>
): OrderItem[] {
  return currentItems.map(item => {
    if (item.item_id === itemId) {
      return {
        ...item,
        ...updates,
        // Preserve nested objects
        files: updates.files !== undefined ? updates.files : item.files,
        specifications: updates.specifications 
          ? { ...item.specifications, ...updates.specifications }
          : item.specifications,
      };
    }
    return item;
  });
}

/**
 * Add new item to order
 */
export function addItemToOrder(
  currentItems: OrderItem[],
  newItem: OrderItem
): OrderItem[] {
  // Check if item already exists
  if (currentItems.some(item => item.item_id === newItem.item_id)) {
    // Update existing item instead
    return mergeItemUpdate(currentItems, newItem.item_id, newItem);
  }
  return [...currentItems, newItem];
}

/**
 * Remove item from order
 */
export function removeItemFromOrder(
  currentItems: OrderItem[],
  itemId: string
): OrderItem[] {
  return currentItems.filter(item => item.item_id !== itemId);
}

/**
 * Add timeline entry (avoid duplicates)
 */
export function addTimelineEntry(
  currentTimeline: TimelineEntry[],
  newEntry: TimelineEntry
): TimelineEntry[] {
  // Check if entry already exists (by timeline_id)
  if (currentTimeline.some(entry => entry.timeline_id === newEntry.timeline_id)) {
    return currentTimeline;
  }
  
  // Insert at beginning (newest first)
  return [newEntry, ...currentTimeline].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Add file to item
 */
export function addFileToItem(
  currentItems: OrderItem[],
  itemId: string,
  newFile: OrderFile
): OrderItem[] {
  return currentItems.map(item => {
    if (item.item_id === itemId) {
      // Check if file already exists
      const fileExists = item.files.some(f => f.file_id === newFile.file_id);
      if (fileExists) {
        return item;
      }
      return {
        ...item,
        files: [...item.files, newFile],
      };
    }
    return item;
  });
}

/**
 * Remove file from item
 */
export function removeFileFromItem(
  currentItems: OrderItem[],
  itemId: string,
  fileId: string
): OrderItem[] {
  return currentItems.map(item => {
    if (item.item_id === itemId) {
      return {
        ...item,
        files: item.files.filter(f => f.file_id !== fileId),
      };
    }
    return item;
  });
}

