import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { detectBlackboardPayload } from '../src/utils/blackboard.js';
import { uniqueRecordKey } from '../src/utils/archiveIdentity.js';
import { markdownToBlocks } from '../src/utils/markdownToBlocks.js';

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));
const STATE_ID = 'main';
const DEFAULT_PROJECT_ID = 'nexus-ui';
const MCP_INSTRUCTIONS = [
  'Use list_projects, list_pages, read_page, and search_pages to find existing Archivolt content.',
  'Use create_note only for new pages and update_note with an exact pageKey for replacements.',
  'Write clean Markdown with ## headings, short paragraphs, bullets, checklists, and language-tagged code fences.',
  'When the user wants a board, graph, workflow, or chart, send only Mermaid, graph JSON, chart JSON, or plain board text.',
  'Never guess a pageKey for an update; search or list pages first.'
].join(' ');

class ArchiveConflictError extends Error {
  constructor() {
    super('Archive changed during the operation; retry the request');
    this.name = 'ArchiveConflictError';
  }
}

const loadEnv = () => {
  try {
    for (const line of readFileSync(resolve(SERVER_DIR, '../.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // ponytail: optional .env, deployments can pass environment variables directly.
  }
};

const getSupabase = () => {
  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

const loadArchive = async (supabase) => {
  const { data, error } = await supabase
    .from('archive_state')
    .select('data, revision, owner_id')
    .eq('id', STATE_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Archive is not initialized');
  if (!data.owner_id) throw new Error('Archive is not claimed by an owner');
  return { projects: data.data || {}, revision: Number(data.revision) || 0 };
};

const saveArchive = async (supabase, projects, expectedRevision) => {
  const revision = expectedRevision + 1;
  const { data, error } = await supabase
    .from('archive_state')
    .update({ data: projects, revision, updated_at: new Date().toISOString() })
    .eq('id', STATE_ID)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ArchiveConflictError();
  return Number(data.revision);
};

const mutateArchive = async (supabase, applyMutation) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const archive = await loadArchive(supabase);
    const projects = structuredClone(archive.projects);
    const result = applyMutation(projects);
    try {
      const revision = await saveArchive(supabase, projects, archive.revision);
      return { ...result, revision };
    } catch (error) {
      if (!(error instanceof ArchiveConflictError) || attempt === 1) throw error;
    }
  }
  throw new ArchiveConflictError();
};

const normalizeTitle = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const resolveProject = (projects, projectId = DEFAULT_PROJECT_ID) => {
  const project = projects[projectId];
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
};

const findPage = (docs = {}, { pageKey, title } = {}) => {
  if (pageKey) {
    if (!docs[pageKey]) throw new Error(`Page not found: ${pageKey}`);
    return { pageKey, doc: docs[pageKey] };
  }
  if (!title) throw new Error('Provide pageKey or title');

  const wanted = normalizeTitle(title);
  const entries = Object.entries(docs);
  const exact = entries.filter(([, doc]) => normalizeTitle(doc.title) === wanted);
  if (exact.length === 1) return { pageKey: exact[0][0], doc: exact[0][1] };

  const close = entries.filter(([, doc]) => {
    const existing = normalizeTitle(doc.title);
    return existing && wanted && (existing.includes(wanted) || wanted.includes(existing));
  });
  if (close.length === 1) return { pageKey: close[0][0], doc: close[0][1] };
  if (close.length > 1) throw new Error(`Ambiguous title "${title}"; candidates: ${close.map(([key]) => key).join(', ')}`);
  throw new Error(`Page not found for title: ${title}`);
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
  if (block.type === 'checklist') return (block.items || []).map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text || ''}`).join('\n');
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

const noteContentFromBody = (body) => {
  const value = String(body || '').trim();
  const payload = detectBlackboardPayload(value);
  return payload.kind === 'text' ? markdownToBlocks(formatNoteBody(body)) : [{ type: 'blackboard', value }];
};

const pageMetadata = (pageKey, doc) => ({
  pageKey,
  title: doc.title || 'Untitled',
  subtitle: doc.subtitle || '',
  pinned: Boolean(doc.pinned),
  updatedAt: doc.updatedAt || null
});

const makeSnippet = (doc, query) => {
  const text = blocksToSearchText(doc.content).replace(/\s+/g, ' ').trim();
  const index = text.toLowerCase().indexOf(String(query).toLowerCase());
  const start = Math.max(0, index - 60);
  return text.slice(start, start + 180);
};

export const listProjects = async ({ supabase }) => {
  const { projects } = await loadArchive(supabase);
  return {
    projects: Object.values(projects).map((project) => ({
      projectId: project.id,
      name: project.name,
      version: project.version || '',
      pageCount: Object.keys(project.docs || {}).length
    }))
  };
};

export const createProject = async ({ supabase, name, projectId, version = 'v1.0.0', pageTitle = 'Index', body = 'New project workspace.', subtitle = 'MCP PROJECT' }) =>
  mutateArchive(supabase, (projects) => {
    const id = projectId || uniqueRecordKey(projects, name, '-', 'project');
    if (projects[id]) throw new Error(`Project already exists: ${id}`);
    const updatedAt = new Date().toISOString();
    projects[id] = {
      id,
      name: String(name || id).toUpperCase(),
      version,
      docs: {
        index: {
          title: pageTitle.toUpperCase(),
          subtitle,
          content: noteContentFromBody(body),
          updatedAt
        }
      }
    };
    return { projectId: id, pageKey: 'index', title: pageTitle.toUpperCase(), action: 'created', updatedAt };
  });

export const createNote = async ({ supabase, projectId = DEFAULT_PROJECT_ID, title, body, subtitle }) =>
  mutateArchive(supabase, (projects) => {
    const project = resolveProject(projects, projectId);
    const pageKey = uniqueRecordKey(project.docs || {}, title, '_', 'note');
    const updatedAt = new Date().toISOString();
    project.docs = {
      [pageKey]: {
        title: title.toUpperCase(),
        subtitle: subtitle || 'MCP NOTE',
        content: noteContentFromBody(body),
        updatedAt
      },
      ...(project.docs || {})
    };
    return { projectId, pageKey, title: title.toUpperCase(), action: 'created', updatedAt };
  });

export const updateNote = async ({ supabase, projectId = DEFAULT_PROJECT_ID, pageKey, title, body, subtitle }) => {
  if (!pageKey) throw new Error('pageKey is required');
  return mutateArchive(supabase, (projects) => {
    const project = resolveProject(projects, projectId);
    const existing = findPage(project.docs || {}, { pageKey }).doc;
    const updatedAt = new Date().toISOString();
    const doc = {
      ...existing,
      title: (title || existing.title || 'Untitled').toUpperCase(),
      subtitle: subtitle || existing.subtitle || 'MCP NOTE',
      content: noteContentFromBody(body),
      updatedAt
    };
    project.docs[pageKey] = doc;
    return { projectId, pageKey, title: doc.title, action: 'updated', updatedAt };
  });
};

export const listPages = async ({ supabase, projectId = DEFAULT_PROJECT_ID, offset = 0, limit = 100 }) => {
  const { projects } = await loadArchive(supabase);
  const pages = Object.entries(resolveProject(projects, projectId).docs || {}).map(([pageKey, doc]) => pageMetadata(pageKey, doc));
  return { projectId, total: pages.length, offset, limit, pages: pages.slice(offset, offset + limit) };
};

export const readPage = async ({ supabase, projectId = DEFAULT_PROJECT_ID, pageKey, title }) => {
  const { projects } = await loadArchive(supabase);
  const match = findPage(resolveProject(projects, projectId).docs || {}, { pageKey, title });
  return {
    projectId,
    pageKey: match.pageKey,
    title: match.doc.title || 'Untitled',
    subtitle: match.doc.subtitle || '',
    markdown: pageToMarkdown(match.doc),
    updatedAt: match.doc.updatedAt || null
  };
};

export const searchPages = async ({ supabase, projectId, query, offset = 0, limit = 20 }) => {
  const { projects } = await loadArchive(supabase);
  const needle = normalizeTitle(query);
  if (!needle) throw new Error('query is required');
  const projectEntries = projectId ? [[projectId, resolveProject(projects, projectId)]] : Object.entries(projects);
  const results = projectEntries.flatMap(([id, project]) => Object.entries(project.docs || {}).flatMap(([pageKey, doc]) => {
    const haystack = normalizeTitle([doc.title, doc.subtitle, blocksToSearchText(doc.content)].filter(Boolean).join(' '));
    return haystack.includes(needle) ? [{ projectId: id, ...pageMetadata(pageKey, doc), snippet: makeSnippet(doc, query) }] : [];
  }));
  return { query, projectId: projectId || null, total: results.length, offset, limit, results: results.slice(offset, offset + limit) };
};

const projectSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  version: z.string(),
  pageCount: z.number().int().nonnegative()
});
const pageSchema = z.object({
  pageKey: z.string(),
  title: z.string(),
  subtitle: z.string(),
  pinned: z.boolean(),
  updatedAt: z.string().nullable()
});
const mutationOutputSchema = {
  projectId: z.string(),
  pageKey: z.string(),
  title: z.string(),
  action: z.enum(['created', 'updated']),
  updatedAt: z.string(),
  revision: z.number().int().nonnegative()
};
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const ADDITIVE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const result = (structuredContent, text) => ({ content: [{ type: 'text', text }], structuredContent });

const selfCheck = async () => {
  let archive = {
    data: { [DEFAULT_PROJECT_ID]: { id: DEFAULT_PROJECT_ID, name: 'ARCHIVOLT', version: 'v1.0.0', docs: {} } },
    revision: 0,
    owner_id: 'owner'
  };
  let injectConflict = false;
  const fakeSupabase = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: archive }) }) }),
      update: (value) => ({
        eq: () => ({
          eq: (_column, expectedRevision) => ({
            select: () => ({
              maybeSingle: async () => {
                if (injectConflict) {
                  injectConflict = false;
                  archive = {
                    ...archive,
                    data: {
                      ...archive.data,
                      [DEFAULT_PROJECT_ID]: {
                        ...archive.data[DEFAULT_PROJECT_ID],
                        docs: { external: { title: 'EXTERNAL', content: [] }, ...archive.data[DEFAULT_PROJECT_ID].docs }
                      }
                    },
                    revision: archive.revision + 1
                  };
                  return { data: null };
                }
                if (archive.revision !== expectedRevision) return { data: null };
                archive = { ...archive, data: value.data, revision: value.revision };
                return { data: { revision: archive.revision } };
              }
            })
          })
        })
      })
    })
  };

  const created = await createNote({ supabase: fakeSupabase, title: 'My Note', body: 'Hello\n\n- one' });
  assert.equal(created.pageKey, 'my_note');
  assert.equal(created.revision, 1);
  const duplicate = await createNote({ supabase: fakeSupabase, title: 'My Note', body: 'Second' });
  assert.equal(duplicate.pageKey, 'my_note_2');
  const project = await createProject({ supabase: fakeSupabase, name: 'Client Notes' });
  const duplicateProject = await createProject({ supabase: fakeSupabase, name: 'Client Notes' });
  assert.equal(project.projectId, 'client-notes');
  assert.equal(duplicateProject.projectId, 'client-notes-2');

  const pages = await listPages({ supabase: fakeSupabase, limit: 1 });
  assert.equal(pages.total, 2);
  assert.equal(pages.pages.length, 1);
  assert.match((await readPage({ supabase: fakeSupabase, pageKey: 'my_note' })).markdown, /# MY NOTE/);
  assert.equal((await searchPages({ supabase: fakeSupabase, query: 'hello' })).total, 1);
  await assert.rejects(() => updateNote({ supabase: fakeSupabase, body: 'No key' }), /pageKey is required/);

  await createNote({ supabase: fakeSupabase, title: 'Alpha Beta', body: 'One' });
  await createNote({ supabase: fakeSupabase, title: 'Alpha Gamma', body: 'Two' });
  await assert.rejects(() => readPage({ supabase: fakeSupabase, title: 'Alpha' }), /Ambiguous title/);

  injectConflict = true;
  const retried = await updateNote({ supabase: fakeSupabase, pageKey: 'my_note', body: 'Retried' });
  assert.equal(retried.revision, archive.revision);
  assert.ok(archive.data[DEFAULT_PROJECT_ID].docs.external, 'retry preserves concurrent mutation');
  assert.deepEqual(result({ ok: true }, 'ok').structuredContent, { ok: true });
};

if (process.argv.includes('--self-check')) {
  await selfCheck();
  process.exit(0);
}

const server = new McpServer(
  { name: 'archivolt', version: '0.3.0' },
  { instructions: MCP_INSTRUCTIONS }
);

server.registerTool('list_projects', {
  title: 'List Archivolt projects',
  description: 'List private Archivolt projects with page counts.',
  outputSchema: { projects: z.array(projectSchema) },
  annotations: READ_ONLY
}, async () => {
  const output = await listProjects({ supabase: getSupabase() });
  return result(output, output.projects.map((project) => `${project.projectId}: ${project.name} (${project.pageCount} pages)`).join('\n') || 'No projects found.');
});

server.registerTool('create_project', {
  title: 'Create Archivolt project',
  description: 'Create a new project with an index page. Existing project IDs are rejected.',
  inputSchema: {
    name: z.string().min(1),
    projectId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    version: z.string().default('v1.0.0'),
    pageTitle: z.string().default('Index'),
    body: z.string().default('New project workspace.'),
    subtitle: z.string().default('MCP PROJECT')
  },
  outputSchema: mutationOutputSchema,
  annotations: ADDITIVE
}, async (input) => {
  const output = await createProject({ supabase: getSupabase(), ...input });
  return result(output, `Created ${output.projectId}/${output.pageKey}\nTitle: ${output.title}`);
});

server.registerTool('list_pages', {
  title: 'List Archivolt pages',
  description: 'List bounded page metadata for one project.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(500).default(100)
  },
  outputSchema: {
    projectId: z.string(),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    pages: z.array(pageSchema)
  },
  annotations: READ_ONLY
}, async (input) => {
  const output = await listPages({ supabase: getSupabase(), ...input });
  return result(output, output.pages.map((page) => `${page.pageKey}: ${page.title}`).join('\n') || 'No pages found.');
});

server.registerTool('read_page', {
  title: 'Read Archivolt page',
  description: 'Read a page by exact pageKey or an unambiguous title match.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID),
    pageKey: z.string().optional(),
    title: z.string().optional()
  },
  outputSchema: {
    projectId: z.string(),
    pageKey: z.string(),
    title: z.string(),
    subtitle: z.string(),
    markdown: z.string(),
    updatedAt: z.string().nullable()
  },
  annotations: READ_ONLY
}, async (input) => {
  const output = await readPage({ supabase: getSupabase(), ...input });
  return result(output, `${output.projectId}/${output.pageKey}\n\n${output.markdown}`);
});

server.registerTool('search_pages', {
  title: 'Search Archivolt pages',
  description: 'Search titles, subtitles, and text content with bounded results.',
  inputSchema: {
    query: z.string().min(1),
    projectId: z.string().optional(),
    offset: z.number().int().nonnegative().default(0),
    limit: z.number().int().min(1).max(50).default(20)
  },
  outputSchema: {
    query: z.string(),
    projectId: z.string().nullable(),
    total: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    results: z.array(pageSchema.extend({ projectId: z.string(), snippet: z.string() }))
  },
  annotations: READ_ONLY
}, async (input) => {
  const output = await searchPages({ supabase: getSupabase(), ...input });
  return result(output, output.results.map((page) => `${page.projectId}/${page.pageKey}: ${page.title}\n  ${page.snippet}`).join('\n') || 'No matching pages.');
});

server.registerTool('create_note', {
  title: 'Create Archivolt note',
  description: 'Always create a new uniquely keyed page from Markdown or a blackboard payload.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID),
    title: z.string().min(1),
    body: z.string().min(1),
    subtitle: z.string().optional()
  },
  outputSchema: mutationOutputSchema,
  annotations: ADDITIVE
}, async (input) => {
  const output = await createNote({ supabase: getSupabase(), ...input });
  return result(output, `Created ${output.projectId}/${output.pageKey}\nTitle: ${output.title}`);
});

server.registerTool('update_note', {
  title: 'Update Archivolt note',
  description: 'Replace an existing page body using an exact pageKey. This never creates a page.',
  inputSchema: {
    projectId: z.string().default(DEFAULT_PROJECT_ID),
    pageKey: z.string().min(1),
    title: z.string().optional(),
    body: z.string().min(1),
    subtitle: z.string().optional()
  },
  outputSchema: mutationOutputSchema,
  annotations: DESTRUCTIVE
}, async (input) => {
  const output = await updateNote({ supabase: getSupabase(), ...input });
  return result(output, `Updated ${output.projectId}/${output.pageKey}\nTitle: ${output.title}`);
});

await server.connect(new StdioServerTransport());
