const toTimestamp = (value) => {
  if (!value) {
    return 0;
  }

  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const sortByLastMessageAtDesc = (items) =>
  [...items].sort((a, b) => toTimestamp(b?.lastMessageAt) - toTimestamp(a?.lastMessageAt));

export const mergeTicketIntoList = (currentData, nextTicket) => {
  if (!currentData || typeof currentData !== 'object') {
    return currentData ?? null;
  }

  if (!nextTicket || typeof nextTicket !== 'object' || !nextTicket.id) {
    return currentData;
  }

  const currentItems = Array.isArray(currentData.items) ? currentData.items : [];
  const existingIndex = currentItems.findIndex((item) => item?.id === nextTicket.id);

  let itemsChanged = false;
  let nextItems;

  if (existingIndex === -1) {
    itemsChanged = true;
    nextItems = [nextTicket, ...currentItems];
  } else {
    nextItems = currentItems.map((item, index) => {
      if (index !== existingIndex) {
        return item;
      }

      const merged = {
        ...item,
        ...nextTicket,
      };

      const hasDifference = Object.keys(nextTicket).some((key) => {
        const previousValue = item?.[key];
        const nextValue = merged[key];
        return !Object.is(previousValue, nextValue);
      });

      if (!hasDifference) {
        return item;
      }

      itemsChanged = true;
      return merged;
    });
  }

  if (!itemsChanged) {
    return currentData;
  }

  const sortedItems = sortByLastMessageAtDesc(nextItems.filter(Boolean));

  const hasReordered = sortedItems.some((item, index) => item !== nextItems[index]);

  if (!hasReordered && currentItems.length === sortedItems.length) {
    return {
      ...currentData,
      items: nextItems,
    };
  }

  return {
    ...currentData,
    items: sortedItems,
  };
};

export default mergeTicketIntoList;
