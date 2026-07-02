import assert from 'node:assert/strict';
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

const uniqueProjectId = (projects, name) => {
  const base = slugify(name).replaceAll('_', '-');
  let projectId = base;
  for (let i = 2; projects[projectId]; i += 1) projectId = `${base}-${i}`;
  return projectId;
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

const resolveProject = (projects, projectId = DEFAULT_PROJECT_ID) => {
  const project = projects[projectId];
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
};

const pageSummary = (pageKey, doc) => [
  `${pageKey}: ${doc.title || 'Untitled'}`,
  `  subtitle: ${doc.subtitle || '-'}`,
  `  pinned: ${Boolean(doc.pinned)}`,
  `  updated: ${doc.updatedAt || '-'}`
].join('\n');

const findPageOrThrow = (docs = {}, { pageKey, title } = {}) => {
  if (pageKey) {
    if (!docs[pageKey]) throw new Error(`Page not found: ${pageKey}`);
    return { pageKey, doc: docs[pageKey] };
  }

  if (!title) throw new Error('Provide pageKey or title');
  const matchedKey = findBestPageKey(docs, title);
  if (!matchedKey) throw new Error(`Page not found for title: ${title}`);
  return { pageKey: matchedKey, doc: docs[matchedKey] };
};

const blocksToSearchText = (blocks = []) => blocks.map((block) => {
  if (block.value || block.caption || block.defaultCode) return block.value || block.caption || block.defaultCode;
  if (Array.isArray(block.items)) {
    return block.items.map((item) => typeof item === 'string' ? item : item.text || item.value || item.label || '').join(' ');
  }
  return '';
}).filter(Boolean).join('\n');

const blockToMarkdown = (block) => {
  if (block.type === 'heading') return `## ${block.value || ''}`;
  if (block.type === 'code') return `\`\`\`${block.language || 'text'}\n${block.value || ''}\n\`\`\``;
  if (block.type === 'list') return (block.items || []).map((item) => `- ${item}`).join('\n');
  if (block.type === 'checklist') {
    return (block.items || []).map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text || ''}`).join('\n');
  }
  if (block.type === 'image') return block.caption || block.value || block.url || '';
  if (block.type === 'playground') return `\`\`\`html\n${block.defaultCode || block.value || ''}\n\`\`\``;
  return block.value || block.caption || block.defaultCode || '';
};

const pageToMarkdown = (doc) => [
  `# ${doc.title || 'Untitled'}`,
  doc.subtitle ? `\n_${doc.subtitle}_` : '',
  ...(doc.content || []).map((block) => `\n${blockToMarkdown(block)}`)
].join('\n').trim();

const formatNoteBody = (body) => {
  let value = String(body || '').replace(/\r\n?/g, '\n').trim();
  value = value.replace(/^\s*\[( |x|X)\]\s+/gm, '- [$1] ');
  value = value.replace(/^```[\t ]*$/gm, '```text');
  value = value.replace(/\n{3,}/g, '\n\n');
  if (!/^#{1,6}\s+/m.test(value)) value = `## Summary\n\n${value}`;
  return value;
};

const savePage = async ({ supabase, projects, projectId, pageKey, doc }) => {
  const project = resolveProject(projects, projectId);
  projects[projectId] = {
    ...project,
    docs: {
      ...(project.docs || {}),
      [pageKey]: doc
    }
  };
  await saveProjects(supabase, projects);
};

export const createProject = async ({
  supabase,
  name,
  projectId,
  version = 'v1.0.0',
  pageTitle = 'Index',
  body = 'New project workspace.',
  subtitle = 'MCP PROJECT',
  overwriteExisting = false
}) => {
  const projects = await loadProjects(supabase);
  const id = projectId || uniqueProjectId(projects, name);
  if (projects[id] && !overwriteExisting) throw new Error(`Project already exists: ${id}`);

  projects[id] = {
    id,
    name: String(name || id).toUpperCase(),
    version,
    docs: {
      index: {
        title: pageTitle.toUpperCase(),
        subtitle,
        content: markdownToBlocks(formatNoteBody(body)),
        updatedAt: new Date().toISOString()
      }
    }
  };

  await saveProjects(supabase, projects);
  return { projectId: id, name: projects[id].name, pageKey: 'index', action: projects[id] ? 'created' : 'created' };
};

export const createNote = async ({ supabase, projectId = DEFAULT_PROJECT_ID, title, body, subtitle, overwriteExisting = false }) => {
  const projects = await loadProjects(supabase);
  const project = resolveProject(projects, projectId);
  const docs = project.docs || {};
  const existingPageKey = overwriteExisting ? findBestPageKey(docs, title) : null;
  const pageKey = existingPageKey || uniqueKey(docs, title);
  const doc = {
    title: title.toUpperCase(),
    subtitle: subtitle || 'MCP NOTE',
    content: markdownToBlocks(formatNoteBody(body)),
    updatedAt: new Date().toISOString()
  };

  await savePage({ supabase, projects, projectId, pageKey, doc });
  return { projectId, pageKey, title: doc.title, action: existingPageKey ? 'updated' : 'created' };
};

export const updateNote = async ({ supabase, projectId = DEFAULT_PROJECT_ID, pageKey, title, body, subtitle }) => {
  const projects = await loadProjects(supabase);
  const project = resolveProject(projects, projectId);
  const match = findPageOrThrow(project.docs || {}, { pageKey, title });
  const doc = {
    ...match.doc,
    title: (title || match.doc.title || 'Untitled').toUpperCase(),
    subtitle: subtitle || match.doc.subtitle || 'MCP NOTE',
    content: markdownToBlocks(formatNoteBody(body)),
    updatedAt: new Date().toISOString()
  };

  await savePage({ supabase, projects, projectId, pageKey: match.pageKey, doc });
  return { projectId, pageKey: match.pageKey, title: doc.title, action: 'updated' };
};

export const listPages = async ({ supabase, projectId = DEFAULT_PROJECT_ID }) => {
  const projects = await loadProjects(supabase);
  const project = resolveProject(projects, projectId);
  return Object.entries(project.docs || {}).map(([pageKey, doc]) => pageSummary(pageKey, doc));
};

export const readPage = async ({ supabase, projectId = DEFAULT_PROJECT_ID, pageKey, title }) => {
  const projects = await loadProjects(supabase);
  const project = resolveProject(projects, projectId);
  const match = findPageOrThrow(project.docs || {}, { pageKey, title });
  return { ...match, markdown: pageToMarkdown(match.doc) };
};

export const searchPages = async ({ supabase, projectId, query }) => {
  const projects = await loadProjects(supabase);
  const needle = normalizeTitle(query);
  if (!needle) throw new Error('query is required');

  const projectEntries = projectId
    ? [[projectId, resolveProject(projects, projectId)]]
    : Object.entries(projects);

  return projectEntries.flatMap(([id, project]) => Object.entries(project.docs || {}).flatMap(([pageKey, doc]) => {
    const haystack = normalizeTitle([doc.title, doc.subtitle, blocksToSearchText(doc.content)].filter(Boolean).join(' '));
    if (!haystack.includes(needle)) return [];
    return [`${id}/${pageKey}: ${doc.title || 'Untitled'} (${doc.subtitle || '-'})`];
  }));
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

  const created = await createNote({ supabase: fakeSupabase, title: 'My Note', body: 'Hello\n\n- one' });
  assert.equal(created.pageKey, 'my_note', 'creates slug key');
  assert.equal(writes[0].data[DEFAULT_PROJECT_ID].docs.my_note.content[0].type, 'heading', 'adds summary heading');
  assert.equal(writes[0].data[DEFAULT_PROJECT_ID].docs.my_note.content.length, 3, 'parses markdown');

  const pages = await listPages({ supabase: fakeSupabase });
  assert.match(pages.join('\n'), /my_note: MY NOTE/, 'lists created note');

  const byKey = await readPage({ supabase: fakeSupabase, pageKey: 'my_note' });
  assert.match(byKey.markdown, /# MY NOTE/, 'reads by key');

  const byTitle = await readPage({ supabase: fakeSupabase, title: 'my note' });
  assert.equal(byTitle.pageKey, 'my_note', 'reads by title');

  const search = await searchPages({ supabase: fakeSupabase, query: 'hello' });
  assert.equal(search.length, 1, 'search finds body text');

  const project = await createProject({ supabase: fakeSupabase, name: 'Client Notes', body: 'Kickoff notes' });
  assert.equal(project.projectId, 'client-notes', 'creates project slug');
  assert.equal(state['client-notes'].docs.index.title, 'INDEX', 'creates index page');
  assert.equal((await listPages({ supabase: fakeSupabase, projectId: 'client-notes' })).length, 1, 'lists new project pages');

  const updated = await updateNote({ supabase: fakeSupabase, title: 'My Note', body: 'Updated', subtitle: 'Fresh' });
  assert.equal(updated.pageKey, 'my_note', 'updates existing note');
  assert.equal(Object.keys(state[DEFAULT_PROJECT_ID].docs).length, 1, 'does not duplicate update');
  assert.equal(state[DEFAULT_PROJECT_ID].docs.my_note.subtitle, 'Fresh', 'updates subtitle');

  await assert.rejects(
    () => updateNote({ supabase: fakeSupabase, title: 'Missing', body: 'Nope' }),
    /Page not found/,
    'missing update fails'
  );
};

if (process.argv.includes('--self-check')) {
  await selfCheck();
  process.exit(0);
}

const server = new McpServer(
  { name: 'archivolt', version: '0.2.0' },
  {
    instructions: 'When creating Archivolt notes, write clean Markdown optimized for Archivolt blocks: use ## headings, short paragraphs, bullets for facts, - [ ] / - [x] for tasks, and fenced code blocks with a language. Use list_pages/read_page/search_pages before updating when the target is unclear. Only set overwriteExisting when the user asks to update, replace, overwrite, or refresh an existing note.'
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

server.registerTool('create_project', {
  title: 'Create Archivolt project',
  description: 'Create a new Archivolt project with an initial index page.',
  inputSchema: {
    name: z.string().min(1),
    projectId: z.string().optional(),
    version: z.string().default('v1.0.0'),
    pageTitle: z.string().default('Index'),
    body: z.string().default('New project workspace.'),
    subtitle: z.string().default('MCP PROJECT'),
    overwriteExisting: z.boolean().default(false)
  }
}, async (input) => {
  const result = await createProject({ supabase: getSupabase(), ...input });
  return {
    content: [{
      type: 'text',
      text: `Created project ${result.projectId}\nName: ${result.name}\nFirst page: ${result.pageKey}`
    }]
  };
});

server.registerTool('list_pages', {
  title: 'List Archivolt pages',
  description: 'List pages in an Archivolt project with page keys and metadata.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID)
  }
}, async (input) => {
  const pages = await listPages({ supabase: getSupabase(), ...input });
  return { content: [{ type: 'text', text: pages.join('\n') || 'No pages found.' }] };
});

server.registerTool('read_page', {
  title: 'Read Archivolt page',
  description: 'Read an Archivolt page by pageKey or best title match.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID),
    pageKey: z.string().optional(),
    title: z.string().optional()
  }
}, async (input) => {
  const page = await readPage({ supabase: getSupabase(), ...input });
  return { content: [{ type: 'text', text: `${page.projectId || input.projectId || DEFAULT_PROJECT_ID}/${page.pageKey}\n\n${page.markdown}` }] };
});

server.registerTool('search_pages', {
  title: 'Search Archivolt pages',
  description: 'Search page titles, subtitles, and text-like block content.',
  inputSchema: {
    query: z.string().min(1),
    projectId: z.string().optional()
  }
}, async (input) => {
  const results = await searchPages({ supabase: getSupabase(), ...input });
  return { content: [{ type: 'text', text: results.join('\n') || 'No matching pages.' }] };
});

server.registerTool('create_note', {
  title: 'Create Archivolt note',
  description: 'Create a Markdown note as an Archivolt page. The server lightly formats plain notes into Archivolt-friendly blocks.',
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
      text: `${result.action === 'updated' ? 'Updated' : 'Created'} ${result.projectId}/${result.pageKey}\nTitle: ${result.title}`
    }]
  };
});

server.registerTool('update_note', {
  title: 'Update Archivolt note',
  description: 'Update an existing Archivolt page by pageKey or title. This never creates a new page.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID),
    pageKey: z.string().optional(),
    title: z.string().optional(),
    body: z.string().min(1),
    subtitle: z.string().optional()
  }
}, async (input) => {
  const result = await updateNote({ supabase: getSupabase(), ...input });
  return {
    content: [{
      type: 'text',
      text: `Updated ${result.projectId}/${result.pageKey}\nTitle: ${result.title}`
    }]
  };
});

await server.connect(new StdioServerTransport());
