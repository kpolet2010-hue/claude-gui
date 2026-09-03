import { useEffect, useState } from 'react';
import ChatBubble from './ChatBubble.jsx';
import { useToast } from './ToastContext.jsx';

function formatSessionDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

export default function SessionsView({ active, vaultVersion }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    if (!active) return;
    setSelectedId(null);
    setMessages(null);
    (async () => setSessions(await window.claudeAPI.listSessions()))();
  }, [active, vaultVersion]);

  useEffect(() => {
    setSearchResults(null);
  }, [search]);

  async function searchContent() {
    if (!search.trim()) return;
    setSearchResults(await window.claudeAPI.searchSessions(search.trim()));
  }

  async function openSession(id) {
    setSelectedId(id);
    setLoadingMessages(true);
    const msgs = await window.claudeAPI.getSession(id);
    setMessages(msgs);
    setLoadingMessages(false);
  }

  async function exportSession() {
    const markdown = messages
      .map((m) => `### ${m.role === 'user' ? 'Du' : 'Claude'}\n\n${m.text}`)
      .join('\n\n---\n\n');
    const saved = await window.claudeAPI.exportChat(markdown);
    if (saved) showToast('Session exportiert.', 'success');
  }

  const list = searchResults !== null ? searchResults : sessions;

  return (
    <div id="sessions-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Verlauf</div>
          <div id="greeting-sub">Deine bisherigen Claude Code Chats in diesem Vault</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="settings-input"
            style={{ width: 200 }}
            placeholder="Inhalt durchsuchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchContent()}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={searchContent} disabled={!search.trim()}>
            Suchen
          </button>
        </div>
      </div>

      <div id="sessions-layout">
        <div id="sessions-list">
          {list.length === 0 && (
            <div className="vault-empty">{searchResults !== null ? 'Keine Treffer.' : 'Keine Chats gefunden.'}</div>
          )}
          {list.map((session) => (
            <button
              type="button"
              key={session.id}
              className={`session-row ${session.id === selectedId ? 'active' : ''}`}
              onClick={() => openSession(session.id)}
            >
              <div className="session-row-title">{session.title}</div>
              {session.snippet ? (
                <div className="session-row-date">…{session.snippet}…</div>
              ) : (
                <div className="session-row-date">{formatSessionDate(session.mtime)}</div>
              )}
            </button>
          ))}
        </div>

        <div id="sessions-detail">
          {selectedId === null && (
            <div id="sessions-detail-empty">Wähle einen Chat aus der Liste.</div>
          )}
          {selectedId !== null && loadingMessages && (
            <div id="sessions-detail-empty">Lädt...</div>
          )}
          {selectedId !== null && !loadingMessages && messages && messages.length === 0 && (
            <div id="sessions-detail-empty">Keine Textinhalte in diesem Chat.</div>
          )}
          {selectedId !== null && !loadingMessages && messages && messages.length > 0 && (
            <>
              <button className="preset-btn" style={{ width: 'auto', marginBottom: 12 }} onClick={exportSession}>
                Exportieren
              </button>
              <div id="sessions-detail-messages">
                {messages.map((msg, i) => (
                  <ChatBubble key={i} role={msg.role} text={msg.text} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
