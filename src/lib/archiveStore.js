import { isSupabaseConfigured, supabase } from './supabase';

const STATE_ID = 'main';
const BUCKET = 'documentation-images';
const LOCAL_SHARES_KEY = 'archivolt.shares';
const STORAGE_PREFIX = 'storage:';

export class ArchiveConflictError extends Error {
  constructor(message = 'Archive changed remotely') {
    super(message);
    this.name = 'ArchiveConflictError';
  }
}

export const claimRemoteArchive = async () => {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('claim_archive');
  if (error) throw error;
  return data?.[0] || null;
};

export const loadRemoteProjects = async () => {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('archive_state')
    .select('data, revision')
    .eq('id', STATE_ID)
    .maybeSingle();

  if (error) throw error;
  return data ? { projects: data.data, revision: Number(data.revision) || 0 } : null;
};

export const saveRemoteProjects = async (projects, expectedRevision, ownerId) => {
  if (!isSupabaseConfigured) return { revision: Number(expectedRevision) || 0 };

  if (expectedRevision == null) {
    const { data, error } = await supabase
      .from('archive_state')
      .insert({ id: STATE_ID, owner_id: ownerId, data: projects, revision: 0 })
      .select('revision')
      .single();
    if (error?.code === '23505') throw new ArchiveConflictError();
    if (error) throw error;
    return { revision: Number(data.revision) || 0 };
  }

  const nextRevision = Number(expectedRevision) + 1;
  const { data, error } = await supabase
    .from('archive_state')
    .update({ data: projects, revision: nextRevision, updated_at: new Date().toISOString() })
    .eq('id', STATE_ID)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ArchiveConflictError();
  return { revision: Number(data.revision) };
};

export const subscribeToRemoteProjects = (onChange) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel('archivolt-archive-state')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'archive_state',
      filter: `id=eq.${STATE_ID}`
    }, ({ new: row }) => {
      if (row?.data) onChange({ projects: row.data, revision: Number(row.revision) || 0 });
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
};

export const loadDocumentShare = async (id) => {
  if (!id) return null;

  if (!isSupabaseConfigured) {
    const shares = JSON.parse(localStorage.getItem(LOCAL_SHARES_KEY) || '{}');
    return shares[id] || null;
  }

  const { data, error } = await supabase
    .from('archive_shares')
    .select('data')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data?.data || null;
};

export const createAssetUrlMap = async (projects) => {
  if (!isSupabaseConfigured) return {};

  const values = new Set();
  for (const project of Object.values(projects || {})) {
    for (const doc of Object.values(project.docs || {})) {
      for (const block of doc.content || []) {
        if (block.url) values.add(block.url);
        if (block.type === 'gallery') {
          String(block.value || '').split('\n').filter(Boolean).forEach((value) => values.add(value.trim()));
        }
        for (const item of block.items || []) {
          if (item?.url) values.add(item.url);
        }
      }
    }
  }

  const entries = await Promise.all([...values].map(async (value) => {
    const path = storagePathFromValue(value);
    if (!path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return error ? null : [value, data.signedUrl];
  }));
  return Object.fromEntries(entries.filter(Boolean));
};

export const uploadImage = async (file, folder = 'uploads') => {
  if (!file) return null;

  if (!isSupabaseConfigured || !(await supabase.auth.getSession()).data.session) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const safeName = (file.name || 'sticker.png').toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return `${STORAGE_PREFIX}${path}`;
};

const storagePathFromValue = (value) => {
  if (typeof value !== 'string') return null;
  if (value.startsWith(STORAGE_PREFIX)) return value.slice(STORAGE_PREFIX.length);

  for (const marker of [
    '/storage/v1/object/public/documentation-images/',
    '/storage/v1/object/sign/documentation-images/'
  ]) {
    const index = value.indexOf(marker);
    if (index >= 0) return decodeURIComponent(value.slice(index + marker.length).split('?')[0]);
  }
  return null;
};
