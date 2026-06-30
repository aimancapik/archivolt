const newBlock = (type, value, extra = {}) => ({
  id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
  type,
  value,
  ...extra
});

const flushParagraph = (blocks, paragraph) => {
  const value = paragraph.join('\n').trim();
  if (value) blocks.push(newBlock('text', value));
  paragraph.length = 0;
};

const flushList = (blocks, list) => {
  if (list.length) blocks.push(newBlock('list', list.join('\n')));
  list.length = 0;
};

const flushChecklist = (blocks, checklist) => {
  if (checklist.length) blocks.push(newBlock('checklist', checklist.join('\n')));
  checklist.length = 0;
};

export const markdownToBlocks = (markdown) => {
  const blocks = [];
  const paragraph = [];
  const list = [];
  const checklist = [];
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  let code = null;

  for (const line of lines) {
    const fence = line.match(/^```([^\s`]*)?\s*$/);
    if (fence) {
      if (code) {
        blocks.push(newBlock('code', code.lines.join('\n'), { language: code.language || 'javascript' }));
        code = null;
      } else {
        flushParagraph(blocks, paragraph);
        flushList(blocks, list);
        flushChecklist(blocks, checklist);
        code = { language: fence[1], lines: [] };
      }
      continue;
    }

    if (code) {
      code.lines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, list);
      flushChecklist(blocks, checklist);
      blocks.push(newBlock('heading', heading[2].trim()));
      continue;
    }

    const checklistItem = line.match(/^\s*[-*]\s+\[(x|X| )\]\s+(.+)$/);
    if (checklistItem) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, list);
      checklist.push(`[${checklistItem[1]}] ${checklistItem[2].trim()}`);
      continue;
    }

    const listItem = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (listItem) {
      flushParagraph(blocks, paragraph);
      flushChecklist(blocks, checklist);
      list.push(listItem[1].trim());
      continue;
    }

    if (!line.trim()) {
      flushParagraph(blocks, paragraph);
      flushList(blocks, list);
      flushChecklist(blocks, checklist);
      continue;
    }

    flushList(blocks, list);
    flushChecklist(blocks, checklist);
    paragraph.push(line);
  }

  if (code) blocks.push(newBlock('code', code.lines.join('\n'), { language: code.language || 'javascript' }));
  flushParagraph(blocks, paragraph);
  flushList(blocks, list);
  flushChecklist(blocks, checklist);

  return blocks.length ? blocks : [newBlock('text', String(markdown || '').trim())].filter((block) => block.value);
};
