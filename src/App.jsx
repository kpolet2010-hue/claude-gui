import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HomeView from './components/HomeView.jsx';
import ChatView from './components/ChatView.jsx';
import UsageView from './components/UsageView.jsx';
import VaultView from './components/VaultView.jsx';
import SessionsView from './components/SessionsView.jsx';
import SettingsView from './components/SettingsView.jsx';

export default function App() {
  const [view, setView] = useState('home');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const [vaultVersion, setVaultVersion] = useState(0);
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
    })();
  }, []);

  useEffect(() => {
    if (!historyLoadedRef.current) return;
    window.claudeAPI.saveHistory(messages);
  }, [messages]);

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

  async function runPrompt(prompt) {
    const continueConversation = hasActiveSessionRef.current;
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: prompt }]);
    streamingAssistantIdRef.current = null;
    streamingErrorIdRef.current = null;
    setBusy(true);
    await window.claudeAPI.runClaude(prompt, continueConversation);
    hasActiveSessionRef.current = true;
    setBusy(false);
    streamingAssistantIdRef.current = null;
    streamingErrorIdRef.current = null;
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

  return (
    <div id="app">
      <Sidebar view={view} setView={setView} busy={busy} runPrompt={runPrompt} />
      <main id="main">
        <HomeView active={view === 'home'} vaultVersion={vaultVersion} />
        <ChatView
          active={view === 'chat'}
          messages={messages}
          busy={busy}
          onSend={runPrompt}
          onStop={stopPrompt}
          onNewChat={newChat}
        />
        <UsageView active={view === 'usage'} vaultVersion={vaultVersion} />
        <VaultView active={view === 'vault'} vaultVersion={vaultVersion} />
        <SessionsView active={view === 'sessions'} vaultVersion={vaultVersion} />
        <SettingsView active={view === 'settings'} onVaultChanged={onVaultChanged} />
      </main>
    </div>
  );
}
