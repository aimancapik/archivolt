import React, { useState, useEffect } from 'react';
import { CodeBlock } from './components/CodeBlock';
import { InteractiveInputDemo } from './components/InteractiveInputDemo';
import { LiveRunner } from './components/LiveRunner';
import { SidebarLayout } from './layouts/SidebarLayout';
import { isSupabaseConfigured } from './lib/supabase';
import { loadRemoteProjects, saveRemoteProjects, uploadImage } from './lib/archiveStore';
import { normalizeSticker, stickerPlacementStyle } from './utils/stickerPlacement';

const STORAGE_KEY = 'archivolt.projects';

// --- PALETTE (inline styles only — no dynamic Tailwind) ---
const PALETTE = [
  {
    bgColor: '#e4decd', textColor: '#1a1b1c', accentColor: '#4a5240',
    borderColor: 'rgba(26,27,28,0.2)',
    gradient: 'linear-gradient(180deg, #ebe6d6 0%, #e4decd 50%, #d9d3c1 100%)',
    pattern: 'dither',
  },
  {
    bgColor: '#b8bdb0', textColor: '#1a1b1c', accentColor: '#3d4a35',
    borderColor: 'rgba(26,27,28,0.2)',
    gradient: 'linear-gradient(180deg, #c3c8bb 0%, #b8bdb0 50%, #aaafa2 100%)',
    pattern: 'lines',
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
    pattern: 'cross',
  },
  {
    bgColor: '#78838b', textColor: '#e4decd', accentColor: '#a8b5be',
    borderColor: 'rgba(228,222,205,0.15)',
    gradient: 'linear-gradient(180deg, #869099 0%, #78838b 50%, #6a757d 100%)',
    pattern: 'dither',
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
          { type: 'playground', defaultCode: "<style>\n  body { background: #111; color: #e4decd; font-family: monospace; padding: 2rem; }\n  button { background: #e4decd; color: #111; border: 1px solid #111; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; box-shadow: 2px 2px 0px #000; transition: all 0.1s ease; }\n  button:hover { background: #f0ebd9; transform: translate(-1px, -1px); box-shadow: 3px 3px 0px #000; }\n  button:active { background: #c3baa2; transform: translate(1px, 1px); box-shadow: 1px 1px 0px #000; }\n</style>\n\n<h1>>> TERMINAL READY</h1>\n<p>System awaiting manual override.</p>\n<button onclick=\"alert('OVERRIDE ACCEPTED')\">EXECUTE</button>" }
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
  const [projects, setProjects] = useState(loadProjects);
  const [remoteReady, setRemoteReady] = useState(!isSupabaseConfigured);
  const [activeProjectId, setActiveProjectId] = useState('nexus-ui');
  const [activePage, setActivePage] = useState('getting_started');
  const [isAddingData, setIsAddingData] = useState(false);
  const [isEditingData, setIsEditingData] = useState(false);
  const initialProjectsRef = React.useRef(projects);

  const activeProject = projects[activeProjectId];
  const hasProjects = Object.keys(projects).length > 0;

  const pageKeys = activeProject ? Object.keys(activeProject.docs) : [];
  const currentIndex = pageKeys.indexOf(activePage);
  const prevPageKey = currentIndex > 0 ? pageKeys[currentIndex - 1] : null;
  const nextPageKey = currentIndex < pageKeys.length - 1 ? pageKeys[currentIndex + 1] : null;
  const currentPageData = activeProject?.docs[activePage] || (activeProject ? Object.values(activeProject.docs)[0] : null);
  const activeTheme = PALETTE[currentIndex >= 0 ? currentIndex % PALETTE.length : 0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    if (remoteReady) {
      saveRemoteProjects(projects).catch((error) => console.warn('Supabase save failed:', error.message));
    }
  }, [projects, remoteReady]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    loadRemoteProjects()
      .then((remoteProjects) => {
        if (remoteProjects) setProjects(remoteProjects);
        else return saveRemoteProjects(initialProjectsRef.current);
      })
      .catch((error) => console.warn('Supabase load failed:', error.message))
      .finally(() => setRemoteReady(true));
  }, []);

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

    return block;
  }));

  const handleSaveNewData = async (formData) => {
    if (formData.recordType === 'document') {
      const newPageId = formData.pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const content = await buildContentBlocks(formData, `${activeProjectId}/${newPageId}`);
      setProjects((prev) => {
        const next = { ...prev };
        const project = { ...next[activeProjectId] };
        const docs = { ...project.docs };
        docs[newPageId] = {
          title: formData.pageTitle.toUpperCase(),
          subtitle: formData.version.toUpperCase(),
          content
        };
        project.docs = docs;
        next[activeProjectId] = project;
        return next;
      });
      setActivePage(newPageId);
      setIsAddingData(false);
      setIsEditingData(false);
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
              title: formData.pageTitle.toUpperCase(), 
              subtitle: "CODE_000 // INIT",
              content
            }
          }
        };
        return next;
      });
      setActiveProjectId(newId);
      setActivePage('index');
      setIsAddingData(false);
      setIsEditingData(false);
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
          content
        }
      };
      next[activeProjectId] = project;
      return next;
    });
    setIsEditingData(false);
    setIsAddingData(false);
  };

  const handleDeleteDocument = () => {
    if (!activeProject || pageKeys.length <= 1) {
      alert('ERROR: PROJECT NEEDS AT LEAST ONE DOCUMENT.');
      return;
    }
    if (!confirm(`Are you sure you want to delete this document: "${currentPageData.title}"?`)) return;

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
  };

  const handleDeleteProject = () => {
    const projectIds = Object.keys(projects);
    if (projectIds.length <= 1) {
      alert('ERROR: ARCHIVE NEEDS AT LEAST ONE PROJECT.');
      return;
    }
    const typedName = prompt(`Type "${activeProject.name}" to delete this project and all documents.`);
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
  };

  const renderContent = (block, index) => {
    switch (block.type) {
      case 'text':
        return <p key={index} className="font-mono-tech leading-relaxed mb-6" style={{ opacity: 0.85, fontSize: '14px' }}>{block.value}</p>;
      case 'heading':
        return <h2 key={index} className="font-serif font-bold mt-14 mb-6 pb-2 inline-block" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', borderBottom: '2px solid currentColor' }}>{block.value}</h2>;
      case 'code':
        return <CodeBlock key={index} language={block.language} code={block.value} />;
      case 'demo-input':
        return <InteractiveInputDemo key={index} />;
      case 'image':
        if (!block.url) return null;
        return (
          <figure key={index} className="my-10 p-2" style={{ border: '1px solid rgba(255,255,255,0.1)', background: '#0d0d0e' }}>
            <img src={block.url} alt="Reference" className="w-full h-auto" style={{ filter: 'grayscale(0.8) contrast(1.15) brightness(0.85)' }} />
            {block.caption && <figcaption className="font-mono-tech uppercase mt-2" style={{ fontSize: '9px', color: '#888' }}>{block.caption}</figcaption>}
          </figure>
        );
      case 'sticker':
        return (
          <img
            key={index}
            src={block.url}
            alt=""
            className="pointer-events-none absolute z-20"
            style={stickerPlacementStyle(block)}
          />
        );
      case 'stickers':
        return (block.items || []).filter((sticker) => sticker.placed ?? true).map((sticker, stickerIndex) => (
          <img
            key={`${index}-${sticker.id || stickerIndex}`}
            src={sticker.url}
            alt=""
            className="pointer-events-none absolute z-20"
            style={stickerPlacementStyle(sticker)}
          />
        ));
      case 'list':
        return (
          <ul key={index} className="font-mono-tech pl-6 mb-6 space-y-3" style={{ listStyleType: 'square', opacity: 0.85, fontSize: '13px' }}>
            {(block.items || []).map((item, i) => <li key={i}>{item}</li>)}
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
      {hasProjects && activeProject ? (
        <SidebarLayout
          projects={projects}
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
          handleSaveNewData={handleSaveNewData}
          handleUpdateDocument={handleUpdateDocument}
          handleDeleteDocument={handleDeleteDocument}
          handleDeleteProject={handleDeleteProject}
          renderContent={renderContent}
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
    </div>
  );
}
