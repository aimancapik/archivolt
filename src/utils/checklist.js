export const checklistItemsFromText = (value, { keepEmpty = false, preserveWhitespace = false } = {}) => String(value || '').split('\n').map((item) => {
  const match = item.match(/^\s*\[(x|X| )\]\s*(.*)$/);
  const text = match ? match[2] : item;
  return { checked: match ? match[1].toLowerCase() === 'x' : false, text: preserveWhitespace ? text : text.trim() };
}).filter((item) => keepEmpty || item.text.trim());

export const checklistTextFromItems = (items = []) => items.map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.text}`).join('\n');
