import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n.jsx';

export default function CommandPalette({ onClose, setView, newChat, runPrompt }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState([]);
  const inputRef = useRef(null);

  const NAV_COMMANDS = [
    { id: 'nav-home', view: 'home', label: t('nav.home') },
    { id: 'nav-chat', view: 'chat', label: t('nav.chat') },
    { id: 'nav-usage', view: 'usage', label: t('nav.usage') },
    { id: 'nav-vault', view: 'vault', label: t('nav.vault') },
    { id: 'nav-sessions', view: 'sessions', label: t('nav.sessions') },
    { id: 'nav-settings', view: 'settings', label: t('nav.settings') },
  ];

  useEffect(() => {
    inputRef.current?.focus();
    (async () => {
      const config = await window.claudeAPI.getConfig();
      setActions(config.customActions || []);
    })();
  }, []);

  function runAction(action) {
    if (action.prompt.includes('{input}')) {
      const input = window.prompt(t('sidebar.action.inputPrompt', { label: action.label }));
      if (!input) return;
      runPrompt(action.prompt.replaceAll('{input}', input));
    } else {
      runPrompt(action.prompt);
    }
  }

  const commands = [
    ...NAV_COMMANDS.map((c) => ({ id: c.id, label: t('palette.goto', { view: c.label }), run: () => setView(c.view) })),
    { id: 'new-chat', label: t('palette.newChat'), run: () => { setView('chat'); newChat(); } },
    ...actions.map((a) => ({ id: `action-${a.id}`, label: t('palette.action', { label: a.label }), run: () => runAction(a) })),
  ];

  const filtered = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
    : commands;

  function execute(cmd) {
    cmd.run();
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && filtered.length) execute(filtered[0]);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="command-palette-list">
          {filtered.map((cmd) => (
            <button key={cmd.id} className="command-palette-item" onClick={() => execute(cmd)}>
              {cmd.label}
            </button>
          ))}
          {!filtered.length && <div className="command-palette-empty">{t('palette.noMatches')}</div>}
        </div>
      </div>
    </div>
  );
}
