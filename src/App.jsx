import React, { useState, useEffect } from 'react';
import { CodeBlock } from './components/CodeBlock';
import { useFeedback } from './hooks/useFeedback.jsx';
import { InteractiveInputDemo } from './components/InteractiveInputDemo';
import { LiveRunner } from './components/LiveRunner';
import { SidebarLayout } from './layouts/SidebarLayout';
import { isSupabaseConfigured } from './lib/supabase';
import { createDocumentShare, loadDocumentShare, loadRemoteProjects, saveRemoteProjects, uploadImage } from './lib/archiveStore';
import { checklistItemsFromText } from './utils/checklist';
import { headingDomId } from './utils/documentStructure';
import { orderedPageKeys } from './utils/pageOrder';
import { normalizeSticker, pointerToStickerPoint, stickerPlacementStyle } from './utils/stickerPlacement';

const STORAGE_KEY = 'archivolt.projects';
const RECENT_KEY = 'archivolt.recentTarget';
const SITE_PASSCODE = '246260';
const SITE_ACCESS_KEY = 'archivolt.siteAccess';
const BACKGROUND_OPTIONS = ['grid', 'dots', 'horizontal-lines', 'vertical-lines', 'checkerboard', 'wave', 'ripple', 'warp', 'beams'];
const FALLBACK_BACKGROUND = 'dots';

const randomBackgroundPattern = () => BACKGROUND_OPTIONS[Math.floor(Math.random() * BACKGROUND_OPTIONS.length)];
const getShareTarget = () => {
  const params = new URLSearchParams(window.location.search);
  const share = params.get('share');
  if (!share) return null;
  if (share !== '1') return { shareId: share };
  return {
    projectId: params.get('project'),
    pageKey: params.get('page')
  };
};

const getPathTarget = () => {
  const [projectId, pageKey] = window.location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  return projectId && pageKey ? { projectId, pageKey } : {};
};

const setPathTarget = (projectId, pageKey) => {
  const nextPath = `/${encodeURIComponent(projectId)}/${encodeURIComponent(pageKey)}`;
  if (window.location.pathname !== nextPath) {
    window.history.replaceState(null, '', `${nextPath}${window.location.search}`);
  }
};

const setHomePath = () => {
  if (window.location.pathname !== '/') window.history.replaceState(null, '', `/${window.location.search}`);
};

// --- PALETTE (inline styles only — no dynamic Tailwind) ---
const PALETTE = [
  {
    bgColor: '#e4decd', textColor: '#1a1b1c', accentColor: '#4a5240',
    borderColor: 'rgba(26,27,28,0.2)',
    gradient: 'linear-gradient(180deg, #ebe6d6 0%, #e4decd 50%, #d9d3c1 100%)',
    pattern: 'grid',
  },
  {
    bgColor: '#b8bdb0', textColor: '#1a1b1c', accentColor: '#3d4a35',
    borderColor: 'rgba(26,27,28,0.2)',
    gradient: 'linear-gradient(180deg, #c3c8bb 0%, #b8bdb0 50%, #aaafa2 100%)',
    pattern: 'horizontal-lines',
  },
  {
    bgColor: '#1a1b1c', textColor: '#e4decd', accentColor: '#c4a35a',
    borderColor: 'rgba(228,222,205,0.15)',
    gradient: 'linear-gradient(180deg, #242526 0%, #1a1b1c 50%, #111213 100%)',
    pattern: 'dots',
  },
  {
    bgColor: '#6b5e4f', textColor: '#e4decd', accentColor: '#c9a96e',
    borderColor: 'rgba(228,222,205,0.15)',
    gradient: 'linear-gradient(180deg, #7a6d5e 0%, #6b5e4f 50%, #5a4e3f 100%)',
    pattern: 'checkerboard',
  },
  {
    bgColor: '#78838b', textColor: '#e4decd', accentColor: '#a8b5be',
    borderColor: 'rgba(228,222,205,0.15)',
    gradient: 'linear-gradient(180deg, #869099 0%, #78838b 50%, #6a757d 100%)',
    pattern: 'dots',
  },
  {
    bgColor: '#2f3a33', textColor: '#e4decd', accentColor: '#9fb58c',
    borderColor: 'rgba(228,222,205,0.16)',
    gradient: 'linear-gradient(180deg, #3b463e 0%, #2f3a33 50%, #232d27 100%)',
    pattern: 'vertical-lines',
  },
  {
    bgColor: '#8a2432', textColor: '#f1e7d3', accentColor: '#f0b2a2',
    borderColor: 'rgba(241,231,211,0.18)',
    gradient: 'linear-gradient(180deg, #9b3140 0%, #8a2432 50%, #681c28 100%)',
    pattern: 'dots',
  },
  {
    bgColor: '#273c5c', textColor: '#e9edf1', accentColor: '#9db7d9',
    borderColor: 'rgba(233,237,241,0.17)',
    gradient: 'linear-gradient(180deg, #31486a 0%, #273c5c 50%, #1e2e47 100%)',
    pattern: 'grid',
  },
  {
    bgColor: '#c7b06b', textColor: '#1a1b1c', accentColor: '#62532a',
    borderColor: 'rgba(26,27,28,0.22)',
    gradient: 'linear-gradient(180deg, #d2bd7c 0%, #c7b06b 50%, #ad9655 100%)',
    pattern: 'checkerboard',
  },
  {
    bgColor: '#d9d6cc', textColor: '#1a1b1c', accentColor: '#60645d',
    borderColor: 'rgba(26,27,28,0.18)',
    gradient: 'linear-gradient(180deg, #e5e1d7 0%, #d9d6cc 50%, #c7c3b8 100%)',
    pattern: 'horizontal-lines',
  },
  {
    bgColor: '#191f2a', textColor: '#e4decd', accentColor: '#8ca0c2',
    borderColor: 'rgba(228,222,205,0.15)',
    gradient: 'linear-gradient(180deg, #242b38 0%, #191f2a 50%, #10151f 100%)',
    pattern: 'dots',
  },
];

// --- MOCK DOCUMENTATION DATA ---
const initialProjectsData = {
  'nexus-ui': {
    id: 'nexus-ui',
    name: 'ARCHIVOLT',
    version: 'v2.4.0',
    docs: {
      getting_started: {
        title: "ARCHIVE LOG",
        subtitle: "CODE_001 // INIT",
        content: [
          { type: 'heading', value: "INITIALIZATION SEQUENCE" },
          { type: 'text', value: "Welcome to the central archive. This documentation outlines the core framework structure. Execute the commands below to begin the synchronization process." },
          { type: 'code', language: 'bash', value: "> npm install nexus-grid\n> initialize_sequence --force" },
          { type: 'heading', value: "SYSTEM BOOT" },
          { type: 'text', value: "Import the core module into your primary operational file:" },
          { type: 'code', language: 'javascript', value: "import { Core } from 'nexus-grid';\n\nfunction Boot() {\n  return <Core status=\"ONLINE\" />;\n}\n\nexport default Boot;" }
        ]
      },
      components: {
        title: "MODULES",
        subtitle: "CODE_002 // UI",
        content: [
          { type: 'heading', value: "INTERFACE COMPONENTS" },
          { type: 'text', value: "Standardized interactive elements for the visual interface." },
          { type: 'image', url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80", caption: "FIG 1: TERMINAL OUTPUT" },
          { type: 'heading', value: "DATA INPUT TERMINAL" },
          { type: 'text', value: "Live interaction block. Awaiting user input to update localized state." },
          { type: 'demo-input' }
        ]
      },
      api_reference: {
        title: "DATA_STRUCT",
        subtitle: "CODE_003 // API",
        content: [
          { type: 'heading', value: "extract_data(ref)" },
          { type: 'text', value: "Parses raw system data into formatted output logs." },
          { type: 'code', language: 'javascript', value: "const log = extract_data('0x7A');\nconsole.log(log); // STATUS: NOMINAL" },
          { type: 'list', items: [
            "ref (STRING): Hexadecimal reference ID.",
            "RETURNS (OBJECT): Parsed system state."
          ]}
        ]
      },
      playground: {
        title: "SIGNAL TEST",
        subtitle: "CODE_004 // LIVE",
        content: [
          { type: 'text', value: "WARNING: Live code execution environment. Proceed with caution." },
          { type: 'playground', defaultCode: "<style>\n  body { background: #111; color: #e4decd; font-family: monospace; padding: 2rem; }\n  button { background: #e4decd; color: #111; border: 1px solid #111; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; box-shadow: 2px 2px 0px #000; transition: all 0.1s ease; }\n  button:hover { background: #f0ebd9; transform: translate(-1px, -1px); box-shadow: 3px 3px 0px #000; }\n  button:active { background: #c3baa2; transform: translate(1px, 1px); box-shadow: 1px 1px 0px #000; }\n</style>\n\n<h1>>> TERMINAL READY</h1>\n<p id=\"signal\">System awaiting manual override.</p>\n<button onclick=\"document.getElementById('signal').textContent='OVERRIDE ACCEPTED'\">EXECUTE</button>" }
        ]
      },
      changelog: {
        title: "DRIFT LOG",
        subtitle: "CODE_005 // DELTA",
        content: [
          { type: 'heading', value: "VERSION DELTA HISTORY" },
          { type: 'text', value: "Chronological record of all system mutations and patch deployments." },
          { type: 'code', language: 'bash', value: "> v2.4.0 — Signal pipeline overhaul\n> v2.3.1 — Memory leak patched in core loop\n> v2.3.0 — Added extract_data() API\n> v2.2.0 — Initial archive structure" }
        ]
      },
      config: {
        title: "SYS_CONF",
        subtitle: "CODE_006 // ENV",
        content: [
          { type: 'heading', value: "ENVIRONMENT VARIABLES" },
          { type: 'text', value: "Override default system behavior via configuration flags." },
          { type: 'code', language: 'javascript', value: "export const CONFIG = {\n  DEBUG_MODE: false,\n  MAX_RETRIES: 3,\n  ARCHIVE_PATH: '/sys/archive/v2',\n  SIGNAL_TIMEOUT: 5000,\n};" },
          { type: 'list', items: [
            "DEBUG_MODE (BOOL): Enable verbose logging.",
            "MAX_RETRIES (INT): Retry count before abort.",
            "ARCHIVE_PATH (STRING): Base directory for records.",
            "SIGNAL_TIMEOUT (INT): Max wait in ms."
          ]}
        ]
      },
      errors: {
        title: "FAULT REF",
        subtitle: "CODE_007 // ERR",
        content: [
          { type: 'heading', value: "ERROR CODES" },
          { type: 'text', value: "Reference table for system fault diagnostics." },
          { type: 'list', items: [
            "ERR_0x01 — Archive path not found",
            "ERR_0x02 — Signal timeout exceeded",
            "ERR_0x03 — Invalid hex reference",
            "ERR_0x04 — Data corruption detected",
            "ERR_0xFF — Unknown system fault"
          ]}
        ]
      },
      credits: {
        title: "ORIGIN",
        subtitle: "CODE_008 // META",
        content: [
          { type: 'heading', value: "ATTRIBUTION" },
          { type: 'text', value: "This archive was constructed by autonomous systems operating under directive 7A. All records are maintained without external intervention." }
        ]
      }
    }
  },
  'project-nova': {
    id: 'project-nova',
    name: 'PROJECT_NOVA',
    version: '02-A',
    docs: {
      welcome: {
        title: "FALLING",
        subtitle: "CODE_005 // NEXT",
        content: [
          { type: 'heading', value: "SECTOR NULL" },
          { type: 'text', value: "This is a secondary project workspace. The archive is vast." }
        ]
      }
    }
  }
};

const loadProjects = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialProjectsData;
  } catch {
    return initialProjectsData;
  }
};

// --- MAIN APPLICATION ---
export default function App() {
  const shareTarget = getShareTarget();
  const pathTarget = getPathTarget();
  const [projects, setProjects] = useState(loadProjects);
  const [sharedProjects, setSharedProjects] = useState(null);
  const [shareError, setShareError] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [siteCodeError, setSiteCodeError] = useState('');
  const [siteUnlocked, setSiteUnlocked] = useState(() => (
    Boolean(shareTarget?.shareId) || localStorage.getItem(SITE_ACCESS_KEY) === '1'
  ));
  const [remoteReady, setRemoteReady] = useState(!isSupabaseConfigured);
  const [activeProjectId, setActiveProjectId] = useState(pathTarget.projectId || 'nexus-ui');
  const [activePage, setActivePage] = useState(pathTarget.pageKey || 'getting_started');
  const [isHomeScreen, setIsHomeScreen] = useState(() => !shareTarget && !pathTarget.projectId);
  const [isAddingData, setIsAddingData] = useState(false);
  const [isEditingData, setIsEditingData] = useState(false);
  const initialProjectsRef = React.useRef(projects);
  const latestProjectsRef = React.useRef(projects);
  const stickerDragOffsetRef = React.useRef({ x: 0, y: 0 });
  const isStickerDraggingRef = React.useRef(false);
  const stickerDragDirtyRef = React.useRef(false);

  const visibleProjects = sharedProjects || projects;
  const activeProject = visibleProjects[activeProjectId];
  const hasProjects = Object.keys(visibleProjects).length > 0;

  const pageKeys = activeProject ? orderedPageKeys(activeProject.docs) : [];
  const currentIndex = pageKeys.indexOf(activePage);
  const prevPageKey = currentIndex > 0 ? pageKeys[currentIndex - 1] : null;
  const nextPageKey = currentIndex < pageKeys.length - 1 ? pageKeys[currentIndex + 1] : null;
  const currentPageData = activeProject?.docs[activePage] || (activeProject ? Object.values(activeProject.docs)[0] : null);
  const baseTheme = PALETTE[currentIndex >= 0 ? currentIndex % PALETTE.length : 0];
  const colorTheme = PALETTE.find((theme) => theme.bgColor === currentPageData?.backgroundColor);
  const activeTheme = colorTheme || baseTheme;
  const backgroundPattern = currentPageData?.backgroundPattern || activeProject?.backgroundPattern || FALLBACK_BACKGROUND;
  const feedback = useFeedback(activeTheme);

  useEffect(() => {
    latestProjectsRef.current = projects;
    if (shareTarget?.shareId) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    if (remoteReady && !isStickerDraggingRef.current && !stickerDragDirtyRef.current) {
      saveRemoteProjects(projects).catch((error) => console.warn('Supabase save failed:', error.message));
    }
  }, [projects, remoteReady, shareTarget?.shareId]);

  useEffect(() => {
    if (isHomeScreen || shareTarget?.shareId || !hasProjects) return;
    const projectId = visibleProjects[activeProjectId] ? activeProjectId : Object.keys(visibleProjects)[0];
    const pageKeys = orderedPageKeys(visibleProjects[projectId].docs);
    if (projectId !== activeProjectId) setActiveProjectId(projectId);
    if (!visibleProjects[projectId].docs[activePage]) setActivePage(pageKeys[0]);
    setPathTarget(projectId, visibleProjects[projectId].docs[activePage] ? activePage : pageKeys[0]);
  }, [activePage, activeProjectId, hasProjects, isHomeScreen, shareTarget?.shareId, visibleProjects]);

  useEffect(() => {
    if (isHomeScreen || shareTarget || !activeProject?.docs?.[activePage]) return;
    localStorage.setItem(RECENT_KEY, JSON.stringify({ projectId: activeProjectId, pageKey: activePage }));
  }, [activePage, activeProject?.docs, activeProjectId, isHomeScreen, shareTarget]);

  useEffect(() => {
    if (!isSupabaseConfigured || shareTarget?.shareId) return;

    loadRemoteProjects()
      .then((remoteProjects) => {
        if (remoteProjects) setProjects(remoteProjects);
        else return saveRemoteProjects(initialProjectsRef.current);
      })
      .catch((error) => console.warn('Supabase load failed:', error.message))
      .finally(() => setRemoteReady(true));
  }, [shareTarget?.shareId]);

  useEffect(() => {
    if (!shareTarget?.shareId) return;

    loadDocumentShare(shareTarget.shareId)
      .then((share) => {
        if (!share?.project || !share?.doc || !share?.pageKey) {
          setShareError('Share not found');
          return;
        }
        setSharedProjects({
          [share.project.id]: {
            ...share.project,
            docs: {
              [share.pageKey]: share.doc
            }
          }
        });
        setActiveProjectId(share.project.id);
        setActivePage(share.pageKey);
        setIsAddingData(false);
        setIsEditingData(false);
      })
      .catch(() => setShareError('Share not found'));
  }, [shareTarget?.shareId]);

  useEffect(() => {
    if (!shareTarget?.projectId || !shareTarget?.pageKey) return;
    if (!visibleProjects[shareTarget.projectId]?.docs?.[shareTarget.pageKey]) return;
    setActiveProjectId(shareTarget.projectId);
    setActivePage(shareTarget.pageKey);
    setIsAddingData(false);
    setIsEditingData(false);
  }, [visibleProjects, shareTarget?.pageKey, shareTarget?.projectId]);

  const buildContentBlocks = async (formData, folder) => Promise.all(formData.blocks.map(async (b) => {
    const block = {
      type: b.type,
      value: b.value,
      language: b.language,
      defaultCode: b.type === 'playground' ? b.value : undefined
    };

    if (b.type === 'image') {
      block.url = b.file ? await uploadImage(b.file, folder) : b.url;
      block.caption = b.value;
    }

    if (b.type === 'sticker') {
      block.url = b.file ? await uploadImage(b.file, folder) : b.url;
      block.x = Number(b.x) || 0;
      block.y = Number(b.y) || 0;
      block.width = Number(b.width) || 180;
      block.rotation = Number(b.rotation) || 0;
    }

    if (b.type === 'stickers') {
      block.items = await Promise.all((b.stickers || []).filter((sticker) => sticker.placed).map(async (sticker) => ({
        id: sticker.id,
        url: sticker.file ? await uploadImage(sticker.file, folder) : sticker.url,
        ...normalizeSticker(sticker),
        placed: true
      })));
    }

    if (b.type === 'list') {
      block.items = b.value.split('\n').map((item) => item.trim()).filter(Boolean);
    }

    if (b.type === 'checklist') {
      block.items = checklistItemsFromText(b.value);
    }

    return block;
  }));

  const openDocument = (projectId, pageKey) => {
    setActiveProjectId(projectId);
    setActivePage(pageKey);
    setIsHomeScreen(false);
    setIsAddingData(false);
    setIsEditingData(false);
    setPathTarget(projectId, pageKey);
  };

  const openProject = (projectId) => {
    const firstPage = orderedPageKeys(visibleProjects[projectId]?.docs || {})[0];
    if (firstPage) openDocument(projectId, firstPage);
  };

  const continueRecent = () => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      if (visibleProjects[recent.projectId]?.docs?.[recent.pageKey]) {
        openDocument(recent.projectId, recent.pageKey);
        return;
      }
    } catch {
      // ponytail: corrupt recent target can fall back to the first project.
    }
    openProject(Object.keys(visibleProjects)[0]);
  };

  const goHome = () => {
    setIsHomeScreen(true);
    setIsAddingData(false);
    setIsEditingData(false);
    setHomePath();
  };

  const renderHomeScreen = () => {
    const projectEntries = Object.values(visibleProjects);
    let recent = null;
    try {
      recent = JSON.parse(localStorage.getItem(RECENT_KEY) || 'null');
    } catch {
      recent = null;
    }
    const recentProject = recent && visibleProjects[recent.projectId];
    const recentDoc = recentProject?.docs?.[recent.pageKey];

    return (
      <main className="h-full w-full overflow-y-auto px-5 py-8 md:px-10 md:py-10" style={{ color: '#e4decd', zIndex: 10 }}>
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center gap-8">
          <header className="border-b pb-5" style={{ borderColor: 'rgba(228,222,205,0.22)' }}>
            <p className="font-mono-tech text-[10px] font-bold uppercase" style={{ opacity: 0.58 }}>Archivolt Home</p>
            <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="font-display text-4xl font-bold uppercase leading-none md:text-6xl">Select Archive</h1>
                <p className="mt-3 max-w-2xl font-mono-tech text-xs uppercase leading-relaxed" style={{ opacity: 0.68 }}>
                  Choose a project, or continue the last record you opened.
                </p>
              </div>
              <button
                type="button"
                onClick={continueRecent}
                disabled={!projectEntries.length}
                className="border px-5 py-3 text-left font-mono-tech text-xs font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                style={{ borderColor: '#e4decd', color: '#e4decd' }}
              >
                Continue Recent
                <span className="mt-1 block max-w-[260px] truncate font-normal" style={{ opacity: 0.62 }}>
                  {recentDoc ? `${recentProject.name} / ${recentDoc.title}` : 'First available record'}
                </span>
              </button>
            </div>
          </header>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Projects">
            {projectEntries.map((project, index) => {
              const keys = orderedPageKeys(project.docs);
              const firstKey = keys[0];
              const latestDoc = keys.map((key) => project.docs[key]).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || project.docs[firstKey];
              const theme = PALETTE[index % PALETTE.length];

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => openProject(project.id)}
                  className="group min-h-[176px] border p-5 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.bgColor,
                    color: theme.textColor,
                    borderColor: theme.borderColor
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono-tech text-[10px] font-bold uppercase" style={{ opacity: 0.58 }}>{project.version}</p>
                      <h2 className="mt-2 font-serif text-3xl font-bold uppercase leading-none">{project.name}</h2>
                    </div>
                    <span className="border px-2 py-1 font-mono-tech text-[10px] font-bold uppercase" style={{ borderColor: theme.textColor }}>
                      {keys.length} rec
                    </span>
                  </div>
                  <div className="mt-8 border-t pt-4" style={{ borderColor: theme.borderColor }}>
                    <p className="font-mono-tech text-[10px] font-bold uppercase" style={{ opacity: 0.55 }}>Latest</p>
                    <p className="mt-1 truncate font-display text-sm font-bold uppercase">{latestDoc?.title || 'Empty project'}</p>
                  </div>
                </button>
              );
            })}
          </section>
        </div>
      </main>
    );
  };

  const handleSaveNewData = async (formData) => {
    if (formData.recordType === 'document') {
      const newPageId = formData.pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const content = await buildContentBlocks(formData, `${activeProjectId}/${newPageId}`);
      setProjects((prev) => {
        const next = { ...prev };
        const project = { ...next[activeProjectId] };
        const existingDoc = project.docs[newPageId];
        const docs = Object.fromEntries(Object.entries(project.docs).filter(([id]) => id !== newPageId));
        project.docs = {
          [newPageId]: {
            backgroundPattern: existingDoc?.backgroundPattern || randomBackgroundPattern(),
            title: formData.pageTitle.toUpperCase(),
            subtitle: formData.version.toUpperCase(),
            content,
            updatedAt: new Date().toISOString()
          },
          ...docs
        };
        next[activeProjectId] = project;
        return next;
      });
      setActivePage(newPageId);
      setIsAddingData(false);
      setIsEditingData(false);
      feedback.notify('Record committed', 'success');
    } else {
      const newId = formData.projectName.toLowerCase().replace(/\s+/g, '-');
      const content = await buildContentBlocks(formData, `${newId}/index`);
      setProjects((prev) => {
        const next = { ...prev };
        next[newId] = {
          id: newId, 
          name: formData.projectName.toUpperCase(), 
          version: formData.version,
          docs: {
            index: {
              backgroundPattern: randomBackgroundPattern(),
              title: formData.pageTitle.toUpperCase(), 
              subtitle: "CODE_000 // INIT",
              content,
              updatedAt: new Date().toISOString()
            }
          }
        };
        return next;
      });
      setActiveProjectId(newId);
      setActivePage('index');
      setIsAddingData(false);
      setIsEditingData(false);
      feedback.notify('Directory created', 'success');
    }
  };

  const handleUpdateDocument = async (formData) => {
    const content = await buildContentBlocks(formData, `${activeProjectId}/${activePage}`);
    setProjects((prev) => {
      const next = { ...prev };
      const project = { ...next[activeProjectId] };
      project.docs = {
        ...project.docs,
        [activePage]: {
          ...project.docs[activePage],
          title: formData.pageTitle.toUpperCase(),
          subtitle: formData.version.toUpperCase(),
          content,
          updatedAt: new Date().toISOString()
        }
      };
      next[activeProjectId] = project;
      return next;
    });
    setIsEditingData(false);
    setIsAddingData(false);
    feedback.notify('Record updated', 'success');
  };

  const handleDeleteDocument = async () => {
    if (!activeProject || pageKeys.length <= 1) {
      feedback.notify('Project needs at least one document', 'danger');
      return;
    }
    const confirmed = await feedback.confirmAction({
      title: 'Delete record',
      message: `Delete "${currentPageData.title}" from ${activeProject.name}?`,
      confirmText: 'Delete',
      tone: 'danger'
    });
    if (!confirmed) return;

    const nextPage = nextPageKey || prevPageKey;
    setProjects((prev) => {
      const next = { ...prev };
      const project = { ...next[activeProjectId] };
      const docs = { ...project.docs };
      delete docs[activePage];
      project.docs = docs;
      next[activeProjectId] = project;
      return next;
    });
    setActivePage(nextPage);
    setIsAddingData(false);
    setIsEditingData(false);
    feedback.notify('Record deleted', 'success');
  };

  const handleDeleteProject = async () => {
    const projectIds = Object.keys(projects);
    if (projectIds.length <= 1) {
      feedback.notify('Archive needs at least one project', 'danger');
      return;
    }
    const typedName = await feedback.promptAction({
      title: 'Delete directory',
      message: `Type "${activeProject.name}" to delete this project and all documents.`,
      confirmText: 'Delete',
      inputLabel: 'Directory name',
      tone: 'danger'
    });
    if (typedName !== activeProject.name) return;

    const nextProjectId = projectIds.find((id) => id !== activeProjectId);
    setProjects((prev) => {
      const next = { ...prev };
      delete next[activeProjectId];
      return next;
    });
    setActiveProjectId(nextProjectId);
    setActivePage(Object.keys(projects[nextProjectId].docs)[0]);
    setIsAddingData(false);
    setIsEditingData(false);
    feedback.notify('Directory deleted', 'success');
  };

  const handleTogglePinDocument = () => {
    if (!activeProject?.docs?.[activePage]) return;
    const willPin = !activeProject.docs[activePage].pinned;
    setProjects((prev) => {
      const next = { ...prev };
      const project = { ...next[activeProjectId] };
      project.docs = {
        ...project.docs,
        [activePage]: {
          ...project.docs[activePage],
          pinned: !project.docs[activePage].pinned
        }
      };
      next[activeProjectId] = project;
      return next;
    });
    feedback.notify(willPin ? 'Record pinned' : 'Record unpinned', 'success');
  };

  const setBackgroundPattern = (pattern) => {
    setProjects((prev) => {
      if (!prev[activeProjectId]?.docs?.[activePage]) return prev;
      return {
        ...prev,
        [activeProjectId]: {
          ...prev[activeProjectId],
          docs: {
            ...prev[activeProjectId].docs,
            [activePage]: {
              ...prev[activeProjectId].docs[activePage],
              backgroundPattern: pattern
            }
          }
        }
      };
    });
  };

  const setBackgroundColor = (color) => {
    setProjects((prev) => {
      if (!prev[activeProjectId]?.docs?.[activePage]) return prev;
      return {
        ...prev,
        [activeProjectId]: {
          ...prev[activeProjectId],
          docs: {
            ...prev[activeProjectId].docs,
            [activePage]: {
              ...prev[activeProjectId].docs[activePage],
              backgroundColor: color
            }
          }
        }
      };
    });
  };

  const createShareLink = async () => {
    if (!activeProject || !currentPageData) return '';

    const shareId = await createDocumentShare({
      project: {
        id: activeProject.id,
        name: activeProject.name,
        version: activeProject.version
      },
      pageKey: activePage,
      doc: currentPageData
    });
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ share: shareId }).toString();
    return url.toString();
  };

  const unlockSite = (event) => {
    event.preventDefault();
    if (siteCode.trim() !== SITE_PASSCODE) {
      setSiteCodeError('Invalid access code');
      return;
    }
    localStorage.setItem(SITE_ACCESS_KEY, '1');
    setSiteCodeError('');
    setSiteUnlocked(true);
  };

  const toggleChecklistItem = (blockIndex, itemIndex) => {
    if (!currentPageData?.content?.[blockIndex] || currentPageData.content[blockIndex].type !== 'checklist') return;
    setProjects((prev) => {
      const next = { ...prev };
      const project = { ...next[activeProjectId] };
      const doc = { ...project.docs[activePage] };
      doc.content = doc.content.map((block, index) => index === blockIndex ? {
        ...block,
        items: (block.items || []).map((item, checklistIndex) => checklistIndex === itemIndex ? { ...item, checked: !item.checked } : item)
      } : block);
      project.docs = { ...project.docs, [activePage]: doc };
      next[activeProjectId] = project;
      return next;
    });
  };

  const moveSticker = (blockIndex, stickerIndex, clientX, clientY, target) => {
    const stage = target.closest('.archive-inner');
    if (!stage) return;
    const point = pointerToStickerPoint(clientX, clientY, stage.getBoundingClientRect());
    const nextPoint = {
      x: Math.min(100, Math.max(0, point.x - stickerDragOffsetRef.current.x)),
      y: Math.min(100, Math.max(0, point.y - stickerDragOffsetRef.current.y))
    };

    setProjects((prev) => {
      if (!prev[activeProjectId]?.docs?.[activePage]?.content?.[blockIndex]) return prev;
      const next = { ...prev };
      const project = { ...next[activeProjectId] };
      const doc = { ...project.docs[activePage] };
      doc.content = doc.content.map((block, index) => {
        if (index !== blockIndex) return block;
        if (block.type === 'sticker') return { ...block, ...nextPoint };
        return {
          ...block,
          items: (block.items || []).map((sticker, index) => index === stickerIndex ? { ...sticker, ...nextPoint } : sticker)
        };
      });
      project.docs = { ...project.docs, [activePage]: doc };
      next[activeProjectId] = project;
      latestProjectsRef.current = next;
      stickerDragDirtyRef.current = true;
      return next;
    });
  };

  const finishStickerDrag = () => {
    isStickerDraggingRef.current = false;
    if (!stickerDragDirtyRef.current || shareTarget?.shareId || !remoteReady) return;
    const projectsToSave = latestProjectsRef.current;
    stickerDragDirtyRef.current = false;
    saveRemoteProjects(projectsToSave).catch((error) => console.warn('Supabase save failed:', error.message));
  };

  const stickerDragProps = (blockIndex, stickerIndex, interactive, sticker) => {
    if (!interactive) return {};

    return {
      role: 'button',
      tabIndex: 0,
      title: 'Drag sticker',
      onPointerDown: (event) => {
        event.preventDefault();
        const stage = event.currentTarget.closest('.archive-inner');
        if (!stage) return;
        const point = pointerToStickerPoint(event.clientX, event.clientY, stage.getBoundingClientRect());
        const current = normalizeSticker(sticker);
        stickerDragOffsetRef.current = {
          x: point.x - current.x,
          y: point.y - current.y
        };
        isStickerDraggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        moveSticker(blockIndex, stickerIndex, event.clientX, event.clientY, event.currentTarget);
      },
      onPointerUp: (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishStickerDrag();
      },
      onPointerCancel: (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishStickerDrag();
      }
    };
  };

  const renderContent = (block, index, { interactive = false } = {}) => {
    switch (block.type) {
      case 'text':
        return <p key={index} className="font-mono-tech leading-relaxed mb-6" style={{ opacity: 0.85, fontSize: '14px' }}>{block.value}</p>;
      case 'heading':
        return <h2 id={headingDomId(activePage, index, block.value)} key={index} className="font-serif font-bold mt-8 mb-3 pb-1.5 inline-block scroll-mt-28" style={{ fontSize: 'clamp(1.35rem, 2.4vw, 1.85rem)', borderBottom: '2px solid currentColor' }}>{block.value}</h2>;
      case 'code':
        return <CodeBlock key={index} language={block.language} code={block.value} />;
      case 'demo-input':
        return <InteractiveInputDemo key={index} />;
      case 'image':
        if (!block.url) return null;
        return (
          <figure key={index} className="my-10 p-2" style={{ border: '1px solid rgba(255,255,255,0.1)', background: '#0d0d0e' }}>
            <img src={block.url} alt="Reference" className="w-full h-auto" />
            {block.caption && <figcaption className="font-mono-tech uppercase mt-2" style={{ fontSize: '9px', color: '#888' }}>{block.caption}</figcaption>}
          </figure>
        );
      case 'sticker':
        return (
          <img
            key={index}
            src={block.url}
            alt=""
            className={`absolute z-40 touch-none select-none ${interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
            style={stickerPlacementStyle(block)}
            {...stickerDragProps(index, 0, interactive, block)}
          />
        );
      case 'stickers':
        return (block.items || []).filter((sticker) => sticker.placed ?? true).map((sticker, stickerIndex) => (
          <img
            key={`${index}-${sticker.id || stickerIndex}`}
            src={sticker.url}
            alt=""
            className={`absolute z-40 touch-none select-none ${interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
            style={stickerPlacementStyle(sticker)}
            {...stickerDragProps(index, stickerIndex, interactive, sticker)}
          />
        ));
      case 'list':
        return (
          <ul key={index} className="font-mono-tech pl-6 mb-6 space-y-3" style={{ listStyleType: 'square', opacity: 0.85, fontSize: '13px' }}>
            {(block.items || []).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
      case 'checklist':
        return (
          <ul key={index} className="font-mono-tech mb-6 space-y-2" style={{ opacity: 0.92, fontSize: '13px' }}>
            {(block.items || []).map((item, i) => (
              <li key={i}>
                <label
                  className="flex items-start gap-3 p-3 transition-colors cursor-pointer"
                  style={{
                    border: `1px solid ${item.checked ? 'rgba(40,200,64,0.35)' : activeTheme.borderColor}`,
                    background: item.checked ? 'rgba(40,200,64,0.08)' : 'rgba(0,0,0,0.08)',
                    borderRadius: '6px'
                  }}
                >
                <input
                  type="checkbox"
                  checked={item.checked}
                  readOnly={!interactive}
                  onChange={() => interactive && toggleChecklistItem(index, i)}
                  aria-label={item.checked ? 'Mark checklist item incomplete' : 'Mark checklist item complete'}
                  className="mt-0.5 h-4 w-4 accent-current cursor-pointer"
                />
                  <span style={{ textDecoration: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.65 : 1 }}>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        );
      case 'playground':
        return <LiveRunner key={index} defaultCode={block.defaultCode} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen relative vignette grain" style={{ background: '#0a0a0b', overflow: 'hidden' }}>
      {shareTarget?.shareId && !sharedProjects && !shareError ? (
        <div className="h-full w-full flex items-center justify-center px-6" style={{ color: '#e4decd', zIndex: 10 }}>
          <div className="max-w-md w-full border p-8 text-center" style={{ borderColor: 'rgba(228,222,205,0.2)', background: '#0d0d0e' }}>
            <h1 className="font-serif font-bold text-4xl mb-3">LOADING SHARE</h1>
            <p className="font-mono-tech text-xs uppercase" style={{ opacity: 0.65 }}>
              Fetching shared documentation.
            </p>
          </div>
        </div>
      ) : shareError ? (
        <div className="h-full w-full flex items-center justify-center px-6" style={{ color: '#e4decd', zIndex: 10 }}>
          <div className="max-w-md w-full border p-8 text-center" style={{ borderColor: 'rgba(228,222,205,0.2)', background: '#0d0d0e' }}>
            <h1 className="font-serif font-bold text-4xl mb-3">SHARE NOT FOUND</h1>
            <p className="font-mono-tech text-xs uppercase" style={{ opacity: 0.65 }}>
              This shared documentation link is invalid or unavailable.
            </p>
          </div>
        </div>
      ) : !shareTarget?.shareId && !siteUnlocked ? (
        <div className="h-full w-full flex items-center justify-center px-6" style={{ color: '#e4decd', zIndex: 10 }}>
          <form onSubmit={unlockSite} className="max-w-md w-full border p-8 text-center" style={{ borderColor: 'rgba(228,222,205,0.2)', background: '#0d0d0e' }}>
            <h1 className="font-serif font-bold text-4xl mb-3">ACCESS CODE</h1>
            <p className="font-mono-tech text-xs uppercase mb-6" style={{ opacity: 0.65 }}>
              Enter the 6 digit code to access Archivolt.
            </p>
            <input
              value={siteCode}
              onChange={(event) => {
                setSiteCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                setSiteCodeError('');
              }}
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoFocus
              className="w-full p-4 bg-transparent text-center font-mono-tech text-2xl tracking-[0.45em] focus:outline-none"
              style={{ border: '1px solid rgba(228,222,205,0.45)', color: '#e4decd' }}
              aria-label="Site access code"
            />
            {siteCodeError && (
              <p className="font-mono-tech text-[10px] uppercase mt-3" style={{ color: '#ff5f57' }}>
                {siteCodeError}
              </p>
            )}
            <button
              type="submit"
              className="mt-6 w-full py-3 border font-display font-bold uppercase cursor-pointer"
              style={{ borderColor: '#e4decd', color: '#e4decd', background: 'transparent', letterSpacing: '0.12em' }}
            >
              Unlock
            </button>
          </form>
        </div>
      ) : hasProjects && isHomeScreen && !shareTarget ? (
        renderHomeScreen()
      ) : hasProjects && activeProject ? (
        <SidebarLayout
          projects={visibleProjects}
          activeProjectId={activeProjectId}
          setActiveProjectId={setActiveProjectId}
          activePage={activePage}
          setActivePage={setActivePage}
          isAddingData={isAddingData}
          setIsAddingData={setIsAddingData}
          isEditingData={isEditingData}
          setIsEditingData={setIsEditingData}
          activeProject={activeProject}
          pageKeys={pageKeys}
          prevPageKey={prevPageKey}
          nextPageKey={nextPageKey}
          activeTheme={activeTheme}
          PALETTE={PALETTE}
          currentPageData={currentPageData}
          backgroundPattern={backgroundPattern}
          setBackgroundPattern={setBackgroundPattern}
          setBackgroundColor={setBackgroundColor}
          handleSaveNewData={handleSaveNewData}
          handleUpdateDocument={handleUpdateDocument}
          handleDeleteDocument={handleDeleteDocument}
          handleDeleteProject={handleDeleteProject}
          handleTogglePinDocument={handleTogglePinDocument}
          confirmAction={feedback.confirmAction}
          notify={feedback.notify}
          orderedPageKeys={orderedPageKeys}
          renderContent={renderContent}
          isSharedView={Boolean(shareTarget)}
          createShareLink={createShareLink}
          goHome={goHome}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center px-6" style={{ color: '#e4decd', zIndex: 10 }}>
          <div className="max-w-md w-full border p-8 text-center" style={{ borderColor: 'rgba(228,222,205,0.2)', background: '#0d0d0e' }}>
            <h1 className="font-serif font-bold text-4xl mb-3">EMPTY ARCHIVE</h1>
            <p className="font-mono-tech text-xs uppercase mb-6" style={{ opacity: 0.65 }}>
              No projects found.
            </p>
            <button
              type="button"
              onClick={() => {
                setProjects(initialProjectsData);
                setActiveProjectId('nexus-ui');
                setActivePage('getting_started');
              }}
              className="px-5 py-3 border font-mono-tech text-xs uppercase cursor-pointer"
              style={{ borderColor: '#e4decd', color: '#e4decd' }}
            >
              Restore Starter Archive
            </button>
          </div>
        </div>
      )}
      {feedback.node}
    </div>
  );
}
