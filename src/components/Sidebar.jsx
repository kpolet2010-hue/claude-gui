export default function Sidebar({ view, setView, busy, runPrompt }) {
  function handleTopicExpand() {
    const topic = window.prompt('Welches Thema soll erweitert werden?');
    if (!topic) return;
    runPrompt(
      `Research ${topic}. Find good sources yourself rather than asking me. Create or expand topic files in /wiki/ covering this, written clearly with code examples where relevant. Link related topics using [[topic-name]] format. Update index.md if new topics are added. Log what was added to log.md. Keep this efficient — avoid excessive tool calls or token usage.`
    );
  }

  function handleBrainSearch() {
    const query = window.prompt('Wonach suchst du?');
    if (!query) return;
    runPrompt(
      `Search /wiki/ and /raw-sources/ for information relevant to: ${query}. If you find a clear answer there, use it and cite which file it came from. Only if nothing relevant is found, search the web for an answer. Keep the answer concise.`
    );
  }

  return (
    <aside id="sidebar">
      <div id="logo"><span className="logo-mark"></span><span>Brain</span></div>
      <div id="logo-sub">Personal Knowledge AI</div>

      <div className="preset-label">Navigation</div>
      <div id="nav">
        <button className={`preset-btn nav-btn ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/></svg>
          Home
        </button>
        <button className={`preset-btn nav-btn ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5Z"/></svg>
          Chat
        </button>
        <button className={`preset-btn nav-btn ${view === 'usage' ? 'active' : ''}`} onClick={() => setView('usage')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>
          Usage
        </button>
        <button className={`preset-btn nav-btn ${view === 'vault' ? 'active' : ''}`} onClick={() => setView('vault')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h9"/></svg>
          Vault
        </button>
        <button className={`preset-btn nav-btn ${view === 'sessions' ? 'active' : ''}`} onClick={() => setView('sessions')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
          Verlauf
        </button>
        <button className={`preset-btn nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.04Z"/></svg>
          Einstellungen
        </button>
      </div>

      <div className="preset-label" style={{ marginTop: 20 }}>Aktionen</div>
      <div id="actions">
        <button
          className="preset-btn action-btn"
          onClick={() => runPrompt('Read all files in /raw-sources/. Compile a wiki in /wiki/ following the rules in CLAUDE.md. Create an index.md first, then one .md file per major topic. Link related topics using [[topic-name]] format. Summarize every source. Log everything to log.md.')}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6M4 13a8 8 0 0 0 13.7 4.7L20 15.4"/><path d="M4 4v4.6h4.6M20 20v-4.6h-4.6"/></svg>
          Wiki neu bauen
        </button>

        <button
          className="preset-btn action-btn"
          onClick={() => runPrompt('Read all files in /raw-sources/. Compare against the existing wiki in /wiki/ and log.md to identify which files or content are new or changed since the last run. For each new or changed piece: summarize it and integrate it into the appropriate existing topic file in /wiki/, or create a new topic file if none fits. Update index.md if new topics were added. Link related topics using [[topic-name]] format. Append a log entry to log.md for each new source processed — do not overwrite existing log entries.')}
        >
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Neue Sources
        </button>

        <button className="preset-btn action-btn" onClick={handleTopicExpand}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h9M4 12h9M4 18h6"/><path d="M13.5 14.5 17 18l3.5-3.5"/><path d="M17 18V9"/></svg>
          Thema erweitern
        </button>

        <button className="preset-btn action-btn" onClick={handleBrainSearch}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>
          Brain-Suche
        </button>
      </div>

      <div id="status">
        <span className={`status-dot ${busy ? 'busy' : ''}`}></span>
        <span>{busy ? 'Läuft...' : 'Bereit'}</span>
      </div>
    </aside>
  );
}
