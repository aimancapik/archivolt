export const orderedPageKeys = (docs = {}) =>
  Object.keys(docs).sort((a, b) => Number(Boolean(docs[b]?.pinned)) - Number(Boolean(docs[a]?.pinned)));
