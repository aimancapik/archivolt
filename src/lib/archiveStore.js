import { isSupabaseConfigured, supabase } from './supabase';

const STATE_ID = 'main';
const BUCKET = 'documentation-images';

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

export const removeImageBackground = async (file) => {
  const { removeBackground } = await import('@imgly/background-removal');
  const blob = await removeBackground(file, {
    model: 'isnet_quint8',
    output: { format: 'image/png', quality: 0.8 }
  });

  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'sticker'}-sticker.png`, { type: 'image/png' });
};
