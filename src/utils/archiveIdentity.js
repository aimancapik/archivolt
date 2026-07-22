export const recordSlug = (value, separator = '_', fallback = 'record') =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, separator).replace(new RegExp(`^\\${separator}+|\\${separator}+$`, 'g'), '') || fallback;

export const uniqueRecordKey = (records, value, separator = '_', fallback = 'record') => {
  const base = recordSlug(value, separator, fallback);
  let key = base;
  for (let index = 2; records?.[key]; index += 1) key = `${base}${separator}${index}`;
  return key;
};

export const shouldSeedArchive = (remoteProjects, localProjects) =>
  !remoteProjects && !localProjects;
