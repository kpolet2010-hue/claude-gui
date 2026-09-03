import { useEffect, useRef, useState } from 'react';

const NAV_COMMANDS = [
  { id: 'nav-home', label: 'Gehe zu: Home', view: 'home' },
  { id: 'nav-chat', label: 'Gehe zu: Chat', view: 'chat' },
  { id: 'nav-usage', label: 'Gehe zu: Usage', view: 'usage' },
  { id: 'nav-vault', label: 'Gehe zu: Vault', view: 'vault' },
  { id: 'nav-sessions', label: 'Gehe zu: Verlauf', view: 'sessions' },
  { id: 'nav-settings', label: 'Gehe zu: Einstellungen', view: 'settings' },
];

export default function CommandPalette({ onClose, setView, newChat, runPrompt }) {
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    (async () => {
      const config = await window.claudeAPI.getConfig();
      setActions(config.customActions || []);
    })();
  }, []);

  function runAction(action) {
    if (action.prompt.includes('{input}')) {
      const input = window.prompt(`Eingabe für "${action.label}"`);
      if (!input) return;
      runPrompt(action.prompt.replaceAll('{input}', input));
    } else {
      runPrompt(action.prompt);
    }
  }

  const commands = [
    ...NAV_COMMANDS.map((c) => ({ id: c.id, label: c.label, run: () => setView(c.view) })),
    { id: 'new-chat', label: 'Neuer Chat', run: () => { setView('chat'); newChat(); } },
    ...actions.map((a) => ({ id: `action-${a.id}`, label: `Aktion: ${a.label}`, run: () => runAction(a) })),
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
          placeholder="Befehl suchen..."
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
          {!filtered.length && <div className="command-palette-empty">Keine Treffer.</div>}
        </div>
      </div>
    </div>
  );
}
