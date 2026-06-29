import { isSupabaseConfigured, supabase } from './supabase';

const STATE_ID = 'main';
const BUCKET = 'documentation-images';
const LOCAL_SHARES_KEY = 'archivolt.shares';

const newShareId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const loadRemoteProjects = async () => {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('archive_state')
    .select('data')
    .eq('id', STATE_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.data || null;
};

export const saveRemoteProjects = async (projects) => {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('archive_state')
    .upsert({ id: STATE_ID, data: projects, updated_at: new Date().toISOString() });

  if (error) throw error;
};

export const createDocumentShare = async (data) => {
  const id = newShareId();

  if (!isSupabaseConfigured) {
    const shares = JSON.parse(localStorage.getItem(LOCAL_SHARES_KEY) || '{}');
    shares[id] = data;
    localStorage.setItem(LOCAL_SHARES_KEY, JSON.stringify(shares));
    return id;
  }

  const { error } = await supabase
    .from('archive_shares')
    .insert({ id, data });

  if (error) throw error;
  return id;
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

export const uploadImage = async (file, folder = 'uploads') => {
  if (!file) return null;

  if (!isSupabaseConfigured) {
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

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
};
