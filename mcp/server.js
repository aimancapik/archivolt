import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { markdownToBlocks } from '../src/utils/markdownToBlocks.js';

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const STATE_ID = 'main';
const DEFAULT_PROJECT_ID = 'nexus-ui';

const loadEnv = () => {
  try {
    for (const line of readFileSync(resolve(SERVER_DIR, '../.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // ponytail: optional .env, real deployments can pass env vars directly.
  }
};

const slugify = (value) => {
  const slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || `note_${Date.now()}`;
};

const normalizeTitle = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const uniqueKey = (docs, title) => {
  const base = slugify(title);
  let key = base;
  for (let i = 2; docs[key]; i += 1) key = `${base}_${i}`;
  return key;
};

const findBestPageKey = (docs, title) => {
  const slug = slugify(title);
  if (docs[slug]) return slug;

  const wanted = normalizeTitle(title);
  const entries = Object.entries(docs);
  const exact = entries.find(([, doc]) => normalizeTitle(doc.title) === wanted);
  if (exact) return exact[0];

  const close = entries.find(([, doc]) => {
    const existing = normalizeTitle(doc.title);
    return existing && wanted && (existing.includes(wanted) || wanted.includes(existing));
  });
  return close?.[0] || null;
};

const fallbackProjects = () => ({
  [DEFAULT_PROJECT_ID]: {
    id: DEFAULT_PROJECT_ID,
    name: 'ARCHIVOLT',
    version: 'v1.0.0',
    docs: {}
  }
});

const getSupabase = () => {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  return createClient(url, key);
};

const loadProjects = async (supabase) => {
  const { data, error } = await supabase.from('archive_state').select('data').eq('id', STATE_ID).maybeSingle();
  if (error) throw error;
  return data?.data || fallbackProjects();
};

const saveProjects = async (supabase, projects) => {
  const { error } = await supabase
    .from('archive_state')
    .upsert({ id: STATE_ID, data: projects, updated_at: new Date().toISOString() });
  if (error) throw error;
};

export const createNote = async ({ supabase, projectId = DEFAULT_PROJECT_ID, title, body, subtitle, overwriteExisting = false }) => {
  const projects = await loadProjects(supabase);
  const project = projects[projectId];
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const docs = project.docs || {};
  const existingPageKey = overwriteExisting ? findBestPageKey(docs, title) : null;
  const pageKey = existingPageKey || uniqueKey(docs, title);
  const doc = {
    title: title.toUpperCase(),
    subtitle: subtitle || 'MCP NOTE',
    content: markdownToBlocks(body),
    updatedAt: new Date().toISOString()
  };

  projects[projectId] = {
    ...project,
    docs: {
      ...docs,
      [pageKey]: doc
    }
  };

  await saveProjects(supabase, projects);
  return { projectId, pageKey, title: doc.title, action: existingPageKey ? 'updated' : 'created' };
};

const selfCheck = async () => {
  const writes = [];
  let state = fallbackProjects();
  const fakeSupabase = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: state } }) }) }),
      upsert: async (value) => {
        writes.push(value);
        state = value.data;
        return {};
      }
    })
  };

  const result = await createNote({ supabase: fakeSupabase, title: 'My Note', body: '# Hello\n\n- one' });
  console.assert(result.pageKey === 'my_note', 'creates slug key');
  console.assert(writes[0].data[DEFAULT_PROJECT_ID].docs.my_note.content.length === 2, 'parses markdown');

  const updated = await createNote({ supabase: fakeSupabase, title: 'My Note', body: 'Updated', overwriteExisting: true });
  console.assert(updated.pageKey === 'my_note', 'updates close title match');
};

if (process.argv.includes('--self-check')) {
  await selfCheck();
  process.exit(0);
}

const server = new McpServer(
  { name: 'archivolt', version: '0.1.0' },
  {
    instructions: 'When creating Archivolt notes, format body as clean Markdown: use ## headings for sections, short paragraphs for notes, bullets for facts, - [ ] / - [x] for tasks, and fenced code blocks with a language when code is useful. Ask/list projects first if the target project is unclear. Only set overwriteExisting when the user asks to update, replace, overwrite, or refresh an existing note.'
  }
);

server.registerTool('list_projects', {
  title: 'List Archivolt projects',
  description: 'List project IDs available in Archivolt.'
}, async () => {
  const projects = await loadProjects(getSupabase());
  const text = Object.values(projects).map((project) => `${project.id}: ${project.name}`).join('\n');
  return { content: [{ type: 'text', text: text || 'No projects found.' }] };
});

server.registerTool('create_note', {
  title: 'Create Archivolt note',
  description: 'Create a well-structured Markdown note as an Archivolt page. Use headings, bullets, checklists, and fenced code blocks so Archivolt renders nicer blocks.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID),
    title: z.string().min(1),
    body: z.string().min(1),
    subtitle: z.string().optional(),
    overwriteExisting: z.boolean().default(false)
  }
}, async (input) => {
  const result = await createNote({ supabase: getSupabase(), ...input });
  return {
    content: [{
      type: 'text',
      text: `${result.action === 'updated' ? 'Updated' : 'Created'} ${result.projectId}/${result.pageKey}`
    }]
  };
});

await server.connect(new StdioServerTransport());
