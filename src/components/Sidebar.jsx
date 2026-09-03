import { useEffect, useState } from 'react';
import { useT } from '../i18n.jsx';

export default function Sidebar({ view, setView, busy, runPrompt, actionsVersion }) {
  const [actions, setActions] = useState([]);
  const t = useT();

  useEffect(() => {
    (async () => {
      const config = await window.claudeAPI.getConfig();
      setActions(config.customActions || []);
    })();
  }, [actionsVersion]);

  function handleAction(action) {
    if (action.prompt.includes('{input}')) {
      const input = window.prompt(t('sidebar.action.inputPrompt', { label: action.label }));
      if (!input) return;
      const prompt = action.prompt.replaceAll('{input}', input);
      runPrompt(prompt, prompt, { checkDiff: true });
    } else {
      runPrompt(action.prompt, action.prompt, { checkDiff: true });
    }
  }

  return (
    <aside id="sidebar">
      <div id="logo"><span className="logo-mark"></span><span>Brain</span></div>
      <div id="logo-sub">{t('sidebar.subtitle')}</div>

      <div className="preset-label">{t('sidebar.navigation')}</div>
      <div id="nav">
        <button className={`preset-btn nav-btn ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/></svg>
          {t('nav.home')}
        </button>
        <button className={`preset-btn nav-btn ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5Z"/></svg>
          {t('nav.chat')}
        </button>
        <button className={`preset-btn nav-btn ${view === 'usage' ? 'active' : ''}`} onClick={() => setView('usage')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>
          {t('nav.usage')}
        </button>
        <button className={`preset-btn nav-btn ${view === 'vault' ? 'active' : ''}`} onClick={() => setView('vault')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h9"/></svg>
          {t('nav.vault')}
        </button>
        <button className={`preset-btn nav-btn ${view === 'sessions' ? 'active' : ''}`} onClick={() => setView('sessions')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
          {t('nav.sessions')}
        </button>
        <button className={`preset-btn nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.04Z"/></svg>
          {t('nav.settings')}
        </button>
      </div>

      <div className="preset-label" style={{ marginTop: 20 }}>{t('sidebar.actions')}</div>
      <div id="actions">
        {actions.map((action) => (
          <button key={action.id} className="preset-btn action-btn" onClick={() => handleAction(action)}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>
            {action.label}
          </button>
        ))}
      </div>

      <div id="status">
        <span className={`status-dot ${busy ? 'busy' : ''}`}></span>
        <span>{busy ? t('sidebar.status.busy') : t('sidebar.status.ready')}</span>
      </div>
    </aside>
  );
}
