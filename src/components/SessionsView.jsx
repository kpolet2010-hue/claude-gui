import { useEffect, useState } from 'react';
import ChatBubble from './ChatBubble.jsx';
import { useToast } from './ToastContext.jsx';
import { useT } from '../i18n.jsx';

function formatSessionDate(iso, t) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('date.today');
  if (days === 1) return t('date.yesterday');
  return t('date.daysAgo', { count: days });
}

export default function SessionsView({ active, vaultVersion }) {
  const t = useT();
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [pinnedIds, setPinnedIds] = useState([]);
  const showToast = useToast();

  useEffect(() => {
    if (!active) return;
    setSelectedId(null);
    setMessages(null);
    (async () => setSessions(await window.claudeAPI.listSessions()))();
    (async () => {
      const config = await window.claudeAPI.getConfig();
      setPinnedIds(config.pins?.sessions || []);
    })();
  }, [active, vaultVersion]);

  useEffect(() => {
    setSearchResults(null);
  }, [search]);

  async function togglePin(id) {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    await window.claudeAPI.togglePin('sessions', id);
  }

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
      .map((m) => `### ${m.role === 'user' ? t('chat.role.user') : t('chat.role.assistant')}\n\n${m.text}`)
      .join('\n\n---\n\n');
    const saved = await window.claudeAPI.exportChat(markdown);
    if (saved) showToast(t('sessions.exportDone'), 'success');
  }

  const baseList = searchResults !== null ? searchResults : sessions;
  const list = [...baseList].sort((a, b) => pinnedIds.includes(b.id) - pinnedIds.includes(a.id));

  return (
    <div id="sessions-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">{t('sessions.title')}</div>
          <div id="greeting-sub">{t('sessions.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="settings-input"
            style={{ width: 200 }}
            placeholder={t('sessions.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchContent()}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={searchContent} disabled={!search.trim()}>
            {t('sessions.search')}
          </button>
        </div>
      </div>

      <div id="sessions-layout">
        <div id="sessions-list">
          {list.length === 0 && (
            <div className="vault-empty">{searchResults !== null ? t('sessions.noMatches') : t('sessions.noSessions')}</div>
          )}
          {list.map((session) => {
            const isPinned = pinnedIds.includes(session.id);
            return (
              <div key={session.id} className={`session-row ${session.id === selectedId ? 'active' : ''} ${isPinned ? 'pinned' : ''}`}>
                <button className="session-row-pin" onClick={() => togglePin(session.id)} title={isPinned ? t('vault.unpin') : t('vault.pin')}>
                  {isPinned ? '★' : '☆'}
                </button>
                <button type="button" className="session-row-open" onClick={() => openSession(session.id)}>
                  <div className="session-row-title">{session.title}</div>
                  {session.snippet ? (
                    <div className="session-row-date">…{session.snippet}…</div>
                  ) : (
                    <div className="session-row-date">{formatSessionDate(session.mtime, t)}</div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div id="sessions-detail">
          {selectedId === null && (
            <div id="sessions-detail-empty">{t('sessions.selectPrompt')}</div>
          )}
          {selectedId !== null && loadingMessages && (
            <div id="sessions-detail-empty">{t('sessions.loading')}</div>
          )}
          {selectedId !== null && !loadingMessages && messages && messages.length === 0 && (
            <div id="sessions-detail-empty">{t('sessions.noText')}</div>
          )}
          {selectedId !== null && !loadingMessages && messages && messages.length > 0 && (
            <>
              <button className="preset-btn" style={{ width: 'auto', marginBottom: 12 }} onClick={exportSession}>
                {t('sessions.export')}
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
