export const slugify = (value = '') =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

export const headingDomId = (pageKey, index, value) =>
  `heading-${slugify(pageKey)}-${index}-${slugify(value)}`;

export const documentHeadings = (content = [], pageKey = 'page') =>
  content
    .map((block, index) => block.type === 'heading' ? {
      id: headingDomId(pageKey, index, block.value),
      index,
      title: block.value
    } : null)
    .filter(Boolean);
