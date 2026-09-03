import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HomeView from './components/HomeView.jsx';
import ChatView from './components/ChatView.jsx';
import UsageView from './components/UsageView.jsx';
import VaultView from './components/VaultView.jsx';
import SessionsView from './components/SessionsView.jsx';

export default function App() {
  const [view, setView] = useState('home');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);
  const streamingIndexRef = useRef(null);

  useEffect(() => {
    window.claudeAPI.onStream((data) => {
      setMessages((prev) => {
        if (streamingIndexRef.current === null) {
          streamingIndexRef.current = prev.length;
          return [...prev, { role: 'assistant', text: data }];
        }
        const idx = streamingIndexRef.current;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], text: updated[idx].text + data };
        return updated;
      });
    });
  }, []);

  async function runPrompt(prompt) {
    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    streamingIndexRef.current = null;
    setBusy(true);
    await window.claudeAPI.runClaude(prompt);
    setBusy(false);
    streamingIndexRef.current = null;
  }

  return (
    <div id="app">
      <Sidebar view={view} setView={setView} busy={busy} runPrompt={runPrompt} />
      <main id="main">
        <HomeView active={view === 'home'} />
        <ChatView active={view === 'chat'} messages={messages} busy={busy} onSend={runPrompt} />
        <UsageView active={view === 'usage'} />
        <VaultView active={view === 'vault'} />
        <SessionsView active={view === 'sessions'} />
      </main>
    </div>
  );
}
