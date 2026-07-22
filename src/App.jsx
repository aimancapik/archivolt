import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { CodeBlock } from './components/CodeBlock';
import { BlackboardBlock } from './components/BlackboardBlock';
import { QuickNoteComposer } from './components/QuickNoteComposer';
import { useFeedback } from './hooks/useFeedback.jsx';
import { InteractiveInputDemo } from './components/InteractiveInputDemo';
import { LiveRunner } from './components/LiveRunner';
import { SidebarLayout } from './layouts/SidebarLayout';
import { DitheringShader } from './components/ui/dithering-shader';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { ArchiveConflictError, claimRemoteArchive, createAssetUrlMap, loadDocumentShare, loadRemoteProjects, saveRemoteProjects, subscribeToRemoteProjects, uploadImage } from './lib/archiveStore';
import { checklistItemsFromText } from './utils/checklist';
import { headingDomId } from './utils/documentStructure';
import { shouldSeedArchive, uniqueRecordKey } from './utils/archiveIdentity';
import { markdownToBlocks } from './utils/markdownToBlocks';
import { orderedPageKeys } from './utils/pageOrder';
import { normalizeSticker, pointerToStickerPoint, stickerPlacementStyle } from './utils/stickerPlacement';

const STORAGE_KEY = 'archivolt.projects';
const RECENT_KEY = 'archivolt.recentTarget';
const CONFLICT_BACKUP_KEY = 'archivolt.conflictBackup';
const BACKGROUND_OPTIONS = ['grid', 'dots', 'horizontal-lines', 'vertical-lines', 'checkerboard', 'wave', 'ripple', 'warp', 'beams'];
const FALLBACK_BACKGROUND = 'dots';
const InteractiveFolderGallery = React.lazy(() => import('./components/ui/interactive-folder-gallery').then((module) => ({ default: module.InteractiveFolderGallery })));

const galleryPhotosFromText = (value = '', resolveAssetUrl = (url) => url) => value
  .split('\n')
  .map((image) => image.trim())
  .filter(Boolean)
  .map((image, index) => ({ id: `${index}-${image}`, image: resolveAssetUrl(image) }));

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
      blackboard: {
        title: "BLACKBOARD",
        subtitle: "CODE_003B // GRAPH",
        content: [
          { type: 'heading', value: "AUTO DETECT BOARD" },
          { type: 'text', value: "This block lets AI output land on a single board surface. Paste graph JSON, chart JSON, Mermaid, or plain notes and the renderer chooses the closest view." },
          {
            type: 'blackboard',
            value: '{\n  "title": "AI output flow",\n  "nodes": [\n    { "id": "prompt", "label": "Prompt" },\n    { "id": "model", "label": "Model" },\n    { "id": "board", "label": "Board" },\n    { "id": "user", "label": "User" }\n  ],\n  "edges": [\n    { "from": "prompt", "to": "model", "label": "input" },\n    { "from": "model", "to": "board", "label": "graph data" },\n    { "from": "board", "to": "user", "label": "visual" }\n  ]\n}'
          },
          { type: 'heading', value: "CHART SHAPE" },
          {
            type: 'blackboard',
            value: '{\n  "title": "Signal strength",\n  "type": "bar",\n  "labels": ["Mon", "Tue", "Wed", "Thu"],\n  "values": [12, 18, 10, 22]\n}'
          }
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

const loadCachedProjects = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const loadProjects = () => loadCachedProjects() || (isSupabaseConfigured ? {} : initialProjectsData);

// --- MAIN APPLICATION ---
export default function App() {
  const shareTarget = getShareTarget();
  const pathTarget = getPathTarget();
  const [projects, setProjects] = useState(loadProjects);
  const [sharedProjects, setSharedProjects] = useState(null);
  const [shareError, setShareError] = useState('');
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [loginEmail, setLoginEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [remoteReady, setRemoteReady] = useState(!isSupabaseConfigured);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'Loading' : 'Saved');
  const [remoteConflict, setRemoteConflict] = useState(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [assetUrls, setAssetUrls] = useState({});
  const [activeProjectId, setActiveProjectId] = useState(pathTarget.projectId || 'nexus-ui');
  const [activePage, setActivePage] = useState(pathTarget.pageKey || 'getting_started');
  const [isHomeScreen, setIsHomeScreen] = useState(() => !shareTarget && !pathTarget.projectId);
  const [isAddingData, setIsAddingData] = useState(false);
  const [isEditingData, setIsEditingData] = useState(false);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState(null);
  const latestProjectsRef = useRef(projects);
  const sessionRef = useRef(session);
  const revisionRef = useRef(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const pendingRevisionRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const conflictRef = useRef(null);
  const stickerDragOffsetRef = useRef({ x: 0, y: 0 });
  const isStickerDraggingRef = useRef(false);
  const stickerDragDirtyRef = useRef(false);

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
  const notify = feedback.notify;
  const resolveAssetUrl = (value) => assetUrls[value] || value;
  const ownerId = session?.user?.id;

  const setConflict = useCallback((value) => {
    conflictRef.current = value;
    setRemoteConflict(value);
  }, []);

  const flushRemoteSave = useCallback(async () => {
    if (!isSupabaseConfigured || !sessionRef.current?.user || !remoteReady || conflictRef.current) return;
    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      return;
    }
    if (!dirtyRef.current) return;

    saveInFlightRef.current = true;
    dirtyRef.current = false;
    setSyncStatus('Saving');
    const expectedRevision = revisionRef.current;
    pendingRevisionRef.current = expectedRevision == null ? 0 : expectedRevision + 1;

    try {
      const result = await saveRemoteProjects(latestProjectsRef.current, expectedRevision, sessionRef.current.user.id);
      revisionRef.current = result.revision;
      pendingRevisionRef.current = null;
      setSyncStatus('Saved');
    } catch (error) {
      pendingRevisionRef.current = null;
      dirtyRef.current = true;
      if (error instanceof ArchiveConflictError) {
        try {
          const remote = await loadRemoteProjects();
          setConflict(remote);
          setConflictOpen(true);
          setSyncStatus('Conflict');
        } catch {
          setSyncStatus('Offline');
        }
      } else {
        setSyncStatus('Offline');
      }
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveRef.current && !conflictRef.current) {
        queuedSaveRef.current = false;
        setTimeout(flushRemoteSave, 0);
      }
    }
  }, [remoteReady, setConflict]);

  const scheduleRemoteSave = useCallback((delay = 400) => {
    if (!isSupabaseConfigured || !sessionRef.current?.user || !remoteReady || conflictRef.current) return;
    clearTimeout(saveTimerRef.current);
    setSyncStatus('Saving');
    saveTimerRef.current = setTimeout(flushRemoteSave, delay);
  }, [flushRemoteSave, remoteReady]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        clearTimeout(saveTimerRef.current);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(RECENT_KEY);
        localStorage.removeItem(CONFLICT_BACKUP_KEY);
        applyingRemoteRef.current = true;
        dirtyRef.current = false;
        setConflict(null);
        setRemoteReady(false);
        setProjects({});
      }
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setConflict]);

  useEffect(() => {
    if (!isSupabaseConfigured || !ownerId) return;
    let cancelled = false;
    setRemoteReady(false);
    setSyncStatus('Loading');

    (async () => {
      await claimRemoteArchive();
      const remote = await loadRemoteProjects();
      const cached = loadCachedProjects();
      const nextProjects = shouldSeedArchive(remote?.projects, cached)
        ? initialProjectsData
        : remote?.projects || cached;

      let revision = remote?.revision ?? null;
      if (!remote && nextProjects) {
        revision = (await saveRemoteProjects(nextProjects, null, ownerId)).revision;
      }
      if (cancelled) return;

      applyingRemoteRef.current = true;
      revisionRef.current = revision;
      dirtyRef.current = false;
      setProjects(nextProjects || {});
      setSyncStatus('Saved');
    })()
      .catch((error) => {
        if (!cancelled) {
          setAuthError(error.message);
          setSyncStatus('Offline');
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  useEffect(() => {
    latestProjectsRef.current = projects;
    if (shareTarget?.shareId) return;
    if (!isSupabaseConfigured || sessionRef.current?.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
    if (applyingRemoteRef.current && !remoteReady) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    if (!isSupabaseConfigured) {
      setSyncStatus('Saved');
      return;
    }
    if (!remoteReady) return;
    dirtyRef.current = true;
    if (!isStickerDraggingRef.current && !stickerDragDirtyRef.current) scheduleRemoteSave();
  }, [projects, remoteReady, scheduleRemoteSave, shareTarget?.shareId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !ownerId || !remoteReady || shareTarget?.shareId) return undefined;
    return subscribeToRemoteProjects((remote) => {
      if (remote.revision <= (revisionRef.current ?? -1)) return;
      if (remote.revision === pendingRevisionRef.current) return;
      if (dirtyRef.current || saveInFlightRef.current || conflictRef.current) {
        setConflict(remote);
        setConflictOpen(true);
        setSyncStatus('Conflict');
        return;
      }
      applyingRemoteRef.current = true;
      revisionRef.current = remote.revision;
      setProjects(remote.projects);
      setSyncStatus('Saved');
    });
  }, [ownerId, remoteReady, setConflict, shareTarget?.shareId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !ownerId) return undefined;
    let cancelled = false;
    const refresh = () => createAssetUrlMap(visibleProjects).then((urls) => {
      if (!cancelled) setAssetUrls(urls);
    });
    const initialTimer = setTimeout(refresh, 100);
    const timer = setInterval(refresh, 45 * 60 * 1000);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, [ownerId, visibleProjects]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const onOnline = () => dirtyRef.current && scheduleRemoteSave(0);
    const onOffline = () => setSyncStatus('Offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearTimeout(saveTimerRef.current);
    };
  }, [scheduleRemoteSave]);

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
    if (!shareTarget?.shareId || (isSupabaseConfigured && !ownerId)) return;

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
  }, [ownerId, shareTarget?.shareId]);

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

    if (b.type === 'gallery') {
      const existingUrls = b.value.split('\n').map((item) => item.trim()).filter(Boolean);
      const uploadedUrls = await Promise.all((b.galleryFiles || []).map((galleryFile) => uploadImage(galleryFile.file, folder)));
      block.value = [...existingUrls, ...uploadedUrls].join('\n');
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
    setAdvancedDraft(null);
    setHomePath();
  };

  const openQuickNote = useCallback((projectId) => {
    const requestedProjectId = projectId || activeProjectId;
    const targetProjectId = visibleProjects[requestedProjectId] ? requestedProjectId : Object.keys(visibleProjects)[0];
    if (!targetProjectId) {
      notify('Create a project before adding a note', 'danger');
      return;
    }
    setActiveProjectId(targetProjectId);
    setIsQuickNoteOpen(true);
  }, [activeProjectId, notify, visibleProjects]);

  const closeQuickNote = async ({ isDirty = false } = {}) => {
    if (isDirty) {
      const confirmed = await feedback.confirmAction({
        title: 'Discard this note?',
        message: 'Your unsaved title and note text will be lost.',
        confirmText: 'Discard',
        tone: 'danger'
      });
      if (!confirmed) return;
    }
    setIsQuickNoteOpen(false);
  };

  const openAdvancedDraft = ({ projectId, title, body }) => {
    const targetProjectId = visibleProjects[projectId] ? projectId : Object.keys(visibleProjects)[0];
    if (!targetProjectId) return;
    const firstPage = orderedPageKeys(visibleProjects[targetProjectId].docs)[0];
    setActiveProjectId(targetProjectId);
    if (firstPage) setActivePage(firstPage);
    setAdvancedDraft({
      recordType: 'document',
      pageTitle: title || 'Untitled note',
      version: 'NOTE // DRAFT',
      blocks: body ? markdownToBlocks(body) : undefined
    });
    setIsQuickNoteOpen(false);
    setIsHomeScreen(false);
    setIsAddingData(true);
    setIsEditingData(false);
  };

  const handleQuickNoteSave = async ({ projectId, title, body }) => {
    const project = projects[projectId];
    if (!project) throw new Error('That project is no longer available.');
    const pageKey = uniqueRecordKey(project.docs, title, '_', 'note');
    const updatedAt = new Date().toISOString();

    setProjects((currentProjects) => ({
      ...currentProjects,
      [projectId]: {
        ...currentProjects[projectId],
        docs: {
          [pageKey]: {
            backgroundPattern: randomBackgroundPattern(),
            title,
            subtitle: 'QUICK NOTE',
            content: body ? markdownToBlocks(body) : [{ type: 'text', value: '' }],
            updatedAt
          },
          ...currentProjects[projectId].docs
        }
      }
    }));
    setIsQuickNoteOpen(false);
    openDocument(projectId, pageKey);
    feedback.notify('Note saved', 'success');
  };

  useEffect(() => {
    const handleNewNoteShortcut = (event) => {
      if (!shareTarget && isHomeScreen && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openQuickNote();
      }
    };
    window.addEventListener('keydown', handleNewNoteShortcut);
    return () => window.removeEventListener('keydown', handleNewNoteShortcut);
  }, [isHomeScreen, openQuickNote, shareTarget]);

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
      <main className="relative h-full w-full overflow-y-auto px-5 py-8 md:px-10 md:py-10" style={{ color: '#e4decd', zIndex: 10 }}>
        <DitheringShader
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 opacity-45"
          color="#e4decd"
          shape="warp"
        />
        <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center gap-8">
          <header className="archive-home-header">
            <div className="archive-home-utility">
              <p className="font-mono-tech text-[10px] font-bold uppercase" style={{ opacity: 0.58 }}>Archivolt / Personal knowledge vault</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncStatus === 'Conflict' && setConflictOpen(true)}
                  className="archive-home-utility-button"
                >
                  <span className={`archive-sync-dot archive-sync-dot--${syncStatus.toLowerCase()}`} aria-hidden="true" />
                  {syncStatus}
                </button>
                {isSupabaseConfigured && (
                  <button type="button" onClick={signOut} className="archive-home-utility-button">Sign out</button>
                )}
              </div>
            </div>
            <div className="archive-home-hero">
              <div>
                <h1>Your archive.</h1>
                <p>
                  Capture a thought in seconds, then shape it when you are ready.
                </p>
              </div>
              <div className="archive-home-actions">
                <button type="button" onClick={() => openQuickNote()} className="archive-home-new-note">
                  <span><Plus aria-hidden="true" /> New note</span>
                  <small>Quick capture / Ctrl or Cmd + Shift + N</small>
                </button>
                <button
                  type="button"
                  onClick={continueRecent}
                  disabled={!projectEntries.length}
                  className="archive-home-continue"
                >
                  <span>Continue where you left off <ArrowRight aria-hidden="true" /></span>
                  <small>
                    {recentDoc ? `${recentProject.name} / ${recentDoc.title}` : 'Open the first available note'}
                  </small>
                </button>
              </div>
            </div>
          </header>

          <section aria-labelledby="archive-projects-title">
            <div className="archive-home-section-heading">
              <h2 id="archive-projects-title">Projects</h2>
              <span>{projectEntries.length} total</span>
            </div>
            <div className="archive-project-grid">
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
                  className="archive-project-card group"
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
                      {keys.length} {keys.length === 1 ? 'note' : 'notes'}
                    </span>
                  </div>
                  <div className="mt-8 border-t pt-4" style={{ borderColor: theme.borderColor }}>
                    <p className="font-mono-tech text-[10px] font-bold uppercase" style={{ opacity: 0.55 }}>Latest</p>
                    <p className="mt-1 truncate font-display text-sm font-bold uppercase">{latestDoc?.title || 'Empty project'}</p>
                  </div>
                </button>
              );
            })}
            </div>
          </section>
        </div>
      </main>
    );
  };

  const handleSaveNewData = async (formData) => {
    if (formData.recordType === 'document') {
      const newPageId = uniqueRecordKey(activeProject.docs, formData.pageTitle, '_', 'note');
      const content = await buildContentBlocks(formData, `${activeProjectId}/${newPageId}`);
      setProjects((prev) => {
        const next = { ...prev };
        const project = { ...next[activeProjectId] };
        project.docs = {
          [newPageId]: {
            backgroundPattern: randomBackgroundPattern(),
            title: formData.pageTitle.toUpperCase(),
            subtitle: formData.version.toUpperCase(),
            content,
            updatedAt: new Date().toISOString()
          },
          ...project.docs
        };
        next[activeProjectId] = project;
        return next;
      });
      setActivePage(newPageId);
      setIsAddingData(false);
      setIsEditingData(false);
      setAdvancedDraft(null);
      feedback.notify('Note created', 'success');
    } else {
      const newId = uniqueRecordKey(projects, formData.projectName, '-', 'project');
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
      setAdvancedDraft(null);
      feedback.notify('Project created', 'success');
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
    feedback.notify('Note updated', 'success');
  };

  const handleDeleteDocument = async () => {
    if (!activeProject || pageKeys.length <= 1) {
      feedback.notify('A project needs at least one note', 'danger');
      return;
    }
    const confirmed = await feedback.confirmAction({
      title: 'Delete note',
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
    feedback.notify('Note deleted', 'success');
  };

  const handleDeleteProject = async () => {
    const projectIds = Object.keys(projects);
    if (projectIds.length <= 1) {
      feedback.notify('Archive needs at least one project', 'danger');
      return;
    }
    const typedName = await feedback.promptAction({
      title: 'Delete project',
      message: `Type "${activeProject.name}" to delete this project and all its notes.`,
      confirmText: 'Delete',
      inputLabel: 'Project name',
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
    feedback.notify('Project deleted', 'success');
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
    feedback.notify(willPin ? 'Note pinned' : 'Note unpinned', 'success');
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

  const sendMagicLink = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: loginEmail.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin
      }
    });
    if (error) setAuthError(error.message);
    else setAuthMessage('Magic link sent. Check your email.');
  };

  const signOut = async () => {
    if (dirtyRef.current || conflictRef.current) {
      const confirmed = await feedback.confirmAction({
        title: 'Sign out with local changes',
        message: 'Unsynced browser changes will be removed from this device.',
        confirmText: 'Sign out',
        tone: 'danger'
      });
      if (!confirmed) return;
    }
    clearTimeout(saveTimerRef.current);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RECENT_KEY);
    localStorage.removeItem(CONFLICT_BACKUP_KEY);
    applyingRemoteRef.current = true;
    dirtyRef.current = false;
    setConflict(null);
    setRemoteReady(false);
    setProjects({});
    await supabase.auth.signOut();
  };

  const keepLocalVersion = async () => {
    if (!session?.user || !remoteConflict) return;
    setSyncStatus('Saving');
    try {
      const result = await saveRemoteProjects(latestProjectsRef.current, remoteConflict.revision, session.user.id);
      revisionRef.current = result.revision;
      dirtyRef.current = false;
      setConflict(null);
      setConflictOpen(false);
      setSyncStatus('Saved');
    } catch (error) {
      const remote = error instanceof ArchiveConflictError ? await loadRemoteProjects() : remoteConflict;
      setConflict(remote);
      setSyncStatus(error instanceof ArchiveConflictError ? 'Conflict' : 'Offline');
    }
  };

  const useRemoteVersion = () => {
    if (!remoteConflict) return;
    localStorage.setItem(CONFLICT_BACKUP_KEY, JSON.stringify({
      createdAt: new Date().toISOString(),
      projects: latestProjectsRef.current
    }));
    applyingRemoteRef.current = true;
    revisionRef.current = remoteConflict.revision;
    dirtyRef.current = false;
    setProjects(remoteConflict.projects);
    setConflict(null);
    setConflictOpen(false);
    setSyncStatus('Saved');
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
    stickerDragDirtyRef.current = false;
    dirtyRef.current = true;
    scheduleRemoteSave(0);
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
      case 'blackboard':
        return <BlackboardBlock key={index} value={block.value} />;
      case 'demo-input':
        return <InteractiveInputDemo key={index} />;
      case 'image':
        if (!block.url) return null;
        return (
          <figure key={index} className="my-10 p-2" style={{ border: '1px solid rgba(255,255,255,0.1)', background: '#0d0d0e' }}>
            <img src={resolveAssetUrl(block.url)} alt="Reference" className="w-full h-auto" />
            {block.caption && <figcaption className="font-mono-tech uppercase mt-2" style={{ fontSize: '9px', color: '#888' }}>{block.caption}</figcaption>}
          </figure>
        );
      case 'gallery': {
        const galleryPhotos = galleryPhotosFromText(block.value, resolveAssetUrl);
        return (
          <React.Suspense key={index} fallback={<div className="font-mono-tech text-[10px] uppercase opacity-60 py-10">Loading gallery...</div>}>
            <InteractiveFolderGallery
              folderName={block.language || 'VISUAL_REFERENCES.gallery'}
              photos={galleryPhotos.length ? galleryPhotos : undefined}
            />
          </React.Suspense>
        );
      }
      case 'sticker':
        return (
          <img
            key={index}
            src={resolveAssetUrl(block.url)}
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
            src={resolveAssetUrl(sticker.url)}
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
      {isSupabaseConfigured && !authReady ? (
        <div className="h-full w-full flex items-center justify-center px-6" style={{ color: '#e4decd', zIndex: 10 }}>
          <div className="max-w-md w-full border p-8 text-center" style={{ borderColor: 'rgba(228,222,205,0.2)', background: '#0d0d0e' }}>
            <h1 className="font-serif font-bold text-4xl mb-3">AUTHORIZING</h1>
            <p className="font-mono-tech text-xs uppercase" style={{ opacity: 0.65 }}>Checking the owner session.</p>
          </div>
        </div>
      ) : isSupabaseConfigured && !session ? (
        <div className="h-full w-full flex items-center justify-center px-6" style={{ color: '#e4decd', zIndex: 10 }}>
          <form onSubmit={sendMagicLink} className="max-w-md w-full border p-8 text-center" style={{ borderColor: 'rgba(228,222,205,0.2)', background: '#0d0d0e' }}>
            <h1 className="font-serif font-bold text-4xl mb-3">OWNER ACCESS</h1>
            <p className="font-mono-tech text-xs uppercase mb-6" style={{ opacity: 0.65 }}>
              Enter the pre-approved owner email for a magic sign-in link.
            </p>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={loginEmail}
              onChange={(event) => {
                setLoginEmail(event.target.value);
                setAuthError('');
                setAuthMessage('');
              }}
              className="w-full p-4 bg-transparent font-mono-tech text-sm focus:outline-none"
              style={{ border: '1px solid rgba(228,222,205,0.45)', color: '#e4decd' }}
              aria-label="Owner email"
              placeholder="owner@example.com"
            />
            {(authError || authMessage) && (
              <p className="font-mono-tech text-[10px] uppercase mt-3" style={{ color: authError ? '#ff5f57' : '#8bd49c' }} role="status">
                {authError || authMessage}
              </p>
            )}
            <button type="submit" className="mt-6 w-full py-3 border font-display font-bold uppercase cursor-pointer" style={{ borderColor: '#e4decd', color: '#e4decd', background: 'transparent', letterSpacing: '0.12em' }}>
              Send Magic Link
            </button>
          </form>
        </div>
      ) : isSupabaseConfigured && !remoteReady ? (
        <div className="h-full w-full flex items-center justify-center px-6" style={{ color: '#e4decd', zIndex: 10 }}>
          <div className="max-w-md w-full border p-8 text-center" style={{ borderColor: 'rgba(228,222,205,0.2)', background: '#0d0d0e' }}>
            <h1 className="font-serif font-bold text-4xl mb-3">LOADING ARCHIVE</h1>
            <p className="font-mono-tech text-xs uppercase" style={{ opacity: 0.65 }}>{authError || 'Claiming the private archive.'}</p>
          </div>
        </div>
      ) : shareTarget?.shareId && !sharedProjects && !shareError ? (
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
          onQuickNote={openQuickNote}
          advancedDraft={advancedDraft}
          onCloseAdvancedEditor={() => setAdvancedDraft(null)}
          confirmAction={feedback.confirmAction}
          notify={feedback.notify}
          orderedPageKeys={orderedPageKeys}
          renderContent={renderContent}
          resolveAssetUrl={resolveAssetUrl}
          isSharedView={Boolean(shareTarget)}
          syncStatus={syncStatus}
          onResolveConflict={() => setConflictOpen(true)}
          onSignOut={isSupabaseConfigured ? signOut : null}
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
      {!shareTarget && hasProjects && (
        <QuickNoteComposer
          open={isQuickNoteOpen}
          projects={visibleProjects}
          defaultProjectId={activeProjectId}
          theme={activeTheme}
          onClose={closeQuickNote}
          onSave={handleQuickNoteSave}
          onAdvanced={openAdvancedDraft}
        />
      )}
      {remoteConflict && conflictOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-label="Resolve archive conflict">
          <div className="w-full max-w-lg border-2 p-6" style={{ borderColor: '#e4decd', background: '#111213', color: '#e4decd' }}>
            <h2 className="font-serif text-3xl font-bold uppercase">Sync Conflict</h2>
            <p className="mt-3 font-mono-tech text-xs leading-relaxed opacity-70">
              The browser and remote archive changed at the same time. Choose which complete archive to keep.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={keepLocalVersion} className="border px-3 py-3 font-mono-tech text-[10px] font-bold uppercase">Keep Local</button>
              <button type="button" onClick={useRemoteVersion} className="border px-3 py-3 font-mono-tech text-[10px] font-bold uppercase">Use Remote</button>
              <button type="button" onClick={() => setConflictOpen(false)} className="border px-3 py-3 font-mono-tech text-[10px] font-bold uppercase">Cancel</button>
            </div>
            <p className="mt-4 font-mono-tech text-[9px] uppercase opacity-50">Using remote stores a local backup first.</p>
          </div>
        </div>
      )}
      {feedback.node}
    </div>
  );
}
