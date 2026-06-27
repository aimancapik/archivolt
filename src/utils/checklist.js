export const checklistItemsFromText = (value, { keepEmpty = false } = {}) => String(value || '').split('\n').map((item) => {
  const match = item.match(/^\s*\[(x|X| )\]\s*(.*)$/);
  return match ? { checked: match[1].toLowerCase() === 'x', text: match[2].trim() } : { checked: false, text: item.trim() };
}).filter((item) => keepEmpty || item.text);

export const checklistTextFromItems = (items = []) => items.map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.text}`).join('\n');
