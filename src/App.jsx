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

export default function App() {
  const [view, setView] = useState('home');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [vaultVersion, setVaultVersion] = useState(0);
  const [actionsVersion, setActionsVersion] = useState(0);
  const [presetsVersion, setPresetsVersion] = useState(0);
  const [vaultSearchTrigger, setVaultSearchTrigger] = useState(0);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [activeVaultName, setActiveVaultName] = useState('Default');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [vaultDiff, setVaultDiff] = useState(null);
  const streamingAssistantIdRef = useRef(null);
  const streamingErrorIdRef = useRef(null);
  const hasActiveSessionRef = useRef(false);
  const historyLoadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const history = await window.claudeAPI.loadHistory();
      if (history && history.length) setMessages(history);
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
    window.claudeAPI.saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    function handleKeyDown(e) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setView('chat');
        newChat();
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

  useEffect(() => {
    window.claudeAPI.onStream((data) => {
      setMessages((prev) => {
        if (streamingAssistantIdRef.current === null) {
          const id = crypto.randomUUID();
          streamingAssistantIdRef.current = id;
          return [...prev, { id, role: 'assistant', text: data }];
        }
        return prev.map((msg) =>
          msg.id === streamingAssistantIdRef.current ? { ...msg, text: msg.text + data } : msg
        );
      });
    });

    window.claudeAPI.onStreamError((data) => {
      setMessages((prev) => {
        if (streamingErrorIdRef.current === null) {
          const id = crypto.randomUUID();
          streamingErrorIdRef.current = id;
          return [...prev, { id, role: 'error', text: data }];
        }
        return prev.map((msg) =>
          msg.id === streamingErrorIdRef.current ? { ...msg, text: msg.text + data } : msg
        );
      });
    });

    window.claudeAPI.onAutoSyncStart(() => {
      streamingAssistantIdRef.current = null;
      streamingErrorIdRef.current = null;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', text: '🔄 Automatisches Sync ("Neue Sources")' },
      ]);
      setBusy(true);
    });

    window.claudeAPI.onAutoSyncEnd(() => {
      setBusy(false);
      streamingAssistantIdRef.current = null;
      streamingErrorIdRef.current = null;
    });
  }, []);

  async function runPrompt(prompt, displayText = prompt, options = {}) {
    const continueConversation = hasActiveSessionRef.current;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: displayText }]);
    streamingAssistantIdRef.current = null;
    streamingErrorIdRef.current = null;
    setBusy(true);
    await window.claudeAPI.runClaude(prompt, continueConversation);
    hasActiveSessionRef.current = true;
    setBusy(false);
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

  function newChat() {
    setMessages([]);
    hasActiveSessionRef.current = false;
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

  return (
    <div id="app">
      <Sidebar view={view} setView={setView} busy={busy} runPrompt={runPrompt} actionsVersion={actionsVersion} />
      <main id="main">
        <HomeView active={view === 'home'} vaultVersion={vaultVersion} />
        <ChatView
          active={view === 'chat'}
          messages={messages}
          busy={busy}
          onSend={runPrompt}
          onStop={stopPrompt}
          onNewChat={newChat}
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
        <CommandPalette onClose={() => setPaletteOpen(false)} setView={setView} newChat={newChat} runPrompt={runPrompt} />
      )}

      {vaultDiff && (
        <Modal title="Änderungen im Vault (git diff)" onClose={() => setVaultDiff(null)}>
          <pre className="modal-plain">{vaultDiff}</pre>
        </Modal>
      )}
    </div>
  );
}
