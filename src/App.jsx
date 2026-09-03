import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HomeView from './components/HomeView.jsx';
import ChatView from './components/ChatView.jsx';
import UsageView from './components/UsageView.jsx';
import VaultView from './components/VaultView.jsx';
import SessionsView from './components/SessionsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import Onboarding from './components/Onboarding.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Modal from './components/Modal.jsx';
import { useT } from './i18n.jsx';

function deriveTitle(messages) {
  const first = messages.find((m) => m.role === 'user');
  return first ? first.text.slice(0, 40) : 'New Chat';
}

function newThread() {
  return { id: crypto.randomUUID(), title: null, messages: [] };
}

export default function App() {
  const t = useT();
  const [view, setView] = useState('home');
  const [busy, setBusy] = useState(false);
  const [threads, setThreads] = useState(() => [newThread()]);
  const [activeThreadId, setActiveThreadId] = useState(() => threads[0]?.id);
  const [vaultVersion, setVaultVersion] = useState(0);
  const [actionsVersion, setActionsVersion] = useState(0);
  const [presetsVersion, setPresetsVersion] = useState(0);
  const [vaultSearchTrigger, setVaultSearchTrigger] = useState(0);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [activeVaultName, setActiveVaultName] = useState('Default');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [vaultDiff, setVaultDiff] = useState(null);
  const streamingThreadIdRef = useRef(null);
  const streamingAssistantIdRef = useRef(null);
  const streamingErrorIdRef = useRef(null);
  const activeSessionRef = useRef(new Map());
  const activeThreadIdRef = useRef(activeThreadId);
  const busyRef = useRef(busy);
  const tRef = useRef(t);
  const historyLoadedRef = useRef(false);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    (async () => {
      const raw = await window.claudeAPI.loadHistory();
      if (Array.isArray(raw) && raw.length) {
        // Legacy single-thread format: wrap the flat message list into one thread.
        const id = crypto.randomUUID();
        setThreads([{ id, title: deriveTitle(raw), messages: raw }]);
        setActiveThreadId(id);
      } else if (raw && Array.isArray(raw.threads) && raw.threads.length) {
        setThreads(raw.threads);
        const validId = raw.threads.some((th) => th.id === raw.activeThreadId);
        setActiveThreadId(validId ? raw.activeThreadId : raw.threads[0].id);
      }
      historyLoadedRef.current = true;
    })();

    (async () => {
      const config = await window.claudeAPI.getConfig();
      document.documentElement.setAttribute('data-theme', config.theme || 'sunset');
      setNeedsSetup(!!config.needsSetup);
      setActiveVaultName(config.activeVault || 'Default');
      setCheckingSetup(false);
    })();
  }, []);

  useEffect(() => {
    if (!historyLoadedRef.current) return;
    window.claudeAPI.saveHistory({ threads, activeThreadId });
  }, [threads, activeThreadId]);

  useEffect(() => {
    function handleKeyDown(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setView('chat');
        if (!busyRef.current) startNewChat();
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setView('vault');
        setVaultSearchTrigger((v) => v + 1);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function updateThreadMessages(threadId, updater) {
    setThreads((prev) => prev.map((th) => (th.id === threadId ? { ...th, messages: updater(th.messages) } : th)));
  }

  useEffect(() => {
    window.claudeAPI.onStream((data) => {
      const threadId = streamingThreadIdRef.current;
      if (!threadId) return;
      updateThreadMessages(threadId, (messages) => {
        if (streamingAssistantIdRef.current === null) {
          const id = crypto.randomUUID();
          streamingAssistantIdRef.current = id;
          return [...messages, { id, role: 'assistant', text: data }];
        }
        return messages.map((msg) => (msg.id === streamingAssistantIdRef.current ? { ...msg, text: msg.text + data } : msg));
      });
    });

    window.claudeAPI.onStreamError((data) => {
      const threadId = streamingThreadIdRef.current;
      if (!threadId) return;
      updateThreadMessages(threadId, (messages) => {
        if (streamingErrorIdRef.current === null) {
          const id = crypto.randomUUID();
          streamingErrorIdRef.current = id;
          return [...messages, { id, role: 'error', text: data }];
        }
        return messages.map((msg) => (msg.id === streamingErrorIdRef.current ? { ...msg, text: msg.text + data } : msg));
      });
    });

    window.claudeAPI.onAutoSyncStart(() => {
      const threadId = activeThreadIdRef.current;
      streamingThreadIdRef.current = threadId;
      streamingAssistantIdRef.current = null;
      streamingErrorIdRef.current = null;
      updateThreadMessages(threadId, (messages) => [
        ...messages,
        { id: crypto.randomUUID(), role: 'user', text: tRef.current('chat.autoSyncLabel') },
      ]);
      setBusy(true);
    });

    window.claudeAPI.onAutoSyncEnd(() => {
      setBusy(false);
      streamingThreadIdRef.current = null;
      streamingAssistantIdRef.current = null;
      streamingErrorIdRef.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runPrompt(prompt, displayText = prompt, options = {}) {
    const threadId = activeThreadId;
    const continueConversation = activeSessionRef.current.get(threadId) || false;
    const userMsg = { id: crypto.randomUUID(), role: 'user', text: displayText };

    setThreads((prev) =>
      prev.map((th) => {
        if (th.id !== threadId) return th;
        const title = th.title || deriveTitle([userMsg]);
        return { ...th, title, messages: [...th.messages, userMsg] };
      })
    );

    streamingThreadIdRef.current = threadId;
    streamingAssistantIdRef.current = null;
    streamingErrorIdRef.current = null;
    setBusy(true);
    await window.claudeAPI.runClaude(prompt, continueConversation);
    activeSessionRef.current.set(threadId, true);
    setBusy(false);
    streamingThreadIdRef.current = null;
    streamingAssistantIdRef.current = null;
    streamingErrorIdRef.current = null;

    if (options.checkDiff) {
      const diff = await window.claudeAPI.getWorkingDiff();
      if (diff && diff.trim()) setVaultDiff(diff);
    }
  }

  async function stopPrompt() {
    await window.claudeAPI.stopClaude();
  }

  function startNewChat() {
    const th = newThread();
    setThreads((prev) => [th, ...prev]);
    setActiveThreadId(th.id);
  }

  function switchThread(id) {
    if (busy) return;
    setActiveThreadId(id);
  }

  function deleteThread(id) {
    const filtered = threads.filter((th) => th.id !== id);
    const finalThreads = filtered.length ? filtered : [newThread()];
    setThreads(finalThreads);
    activeSessionRef.current.delete(id);
    if (id === activeThreadId) setActiveThreadId(finalThreads[0].id);
  }

  function renameThread(id, title) {
    setThreads((prev) => prev.map((th) => (th.id === id ? { ...th, title } : th)));
  }

  function onVaultChanged() {
    setVaultVersion((v) => v + 1);
  }

  function onActionsChanged() {
    setActionsVersion((v) => v + 1);
  }

  function onPresetsChanged() {
    setPresetsVersion((v) => v + 1);
  }

  if (checkingSetup) return null;

  if (needsSetup) {
    return (
      <Onboarding
        vaultName={activeVaultName}
        onComplete={() => {
          setNeedsSetup(false);
          onVaultChanged();
        }}
      />
    );
  }

  const activeThread = threads.find((th) => th.id === activeThreadId) || threads[0];

  return (
    <div id="app">
      <Sidebar view={view} setView={setView} busy={busy} runPrompt={runPrompt} actionsVersion={actionsVersion} />
      <main id="main">
        <HomeView active={view === 'home'} vaultVersion={vaultVersion} />
        <ChatView
          active={view === 'chat'}
          threads={threads}
          activeThreadId={activeThread.id}
          messages={activeThread.messages}
          busy={busy}
          onSend={runPrompt}
          onStop={stopPrompt}
          onNewChat={startNewChat}
          onSwitchThread={switchThread}
          onDeleteThread={deleteThread}
          onRenameThread={renameThread}
          vaultVersion={vaultVersion}
          presetsVersion={presetsVersion}
        />
        <UsageView active={view === 'usage'} vaultVersion={vaultVersion} />
        <VaultView
          active={view === 'vault'}
          vaultVersion={vaultVersion}
          onVaultChanged={onVaultChanged}
          searchTrigger={vaultSearchTrigger}
        />
        <SessionsView active={view === 'sessions'} vaultVersion={vaultVersion} />
        <SettingsView
          active={view === 'settings'}
          onVaultChanged={onVaultChanged}
          onActionsChanged={onActionsChanged}
          onPresetsChanged={onPresetsChanged}
        />
      </main>

      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} setView={setView} newChat={startNewChat} runPrompt={runPrompt} />
      )}

      {vaultDiff && (
        <Modal title={t('diffModal.title')} onClose={() => setVaultDiff(null)}>
          <pre className="modal-plain">{vaultDiff}</pre>
        </Modal>
      )}
    </div>
  );
}
