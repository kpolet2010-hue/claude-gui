import { useEffect, useState } from 'react';
import ChatBubble from './ChatBubble.jsx';

function formatSessionDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

export default function SessionsView({ active }) {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (!active) return;
    setSelectedId(null);
    setMessages(null);
    (async () => setSessions(await window.claudeAPI.listSessions()))();
  }, [active]);

  async function openSession(id) {
    setSelectedId(id);
    setLoadingMessages(true);
    const msgs = await window.claudeAPI.getSession(id);
    setMessages(msgs);
    setLoadingMessages(false);
  }

  return (
    <div id="sessions-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Verlauf</div>
          <div id="greeting-sub">Deine bisherigen Claude Code Chats in diesem Vault</div>
        </div>
      </div>

      <div id="sessions-layout">
        <div id="sessions-list">
          {sessions.length === 0 && <div className="vault-empty">Keine Chats gefunden.</div>}
          {sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={`session-row ${session.id === selectedId ? 'active' : ''}`}
              onClick={() => openSession(session.id)}
            >
              <div className="session-row-title">{session.title}</div>
              <div className="session-row-date">{formatSessionDate(session.mtime)}</div>
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
            <div id="sessions-detail-messages">
              {messages.map((msg, i) => (
                <ChatBubble key={i} role={msg.role} text={msg.text} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
