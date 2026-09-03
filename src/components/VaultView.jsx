import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Modal from './Modal.jsx';
import WikiGraph from './WikiGraph.jsx';
import { useToast } from './ToastContext.jsx';

function formatRelativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

function VaultList({ items, isWiki, onOpen }) {
  if (!items.length) {
    return <div className="vault-empty">Keine Dateien gefunden.</div>;
  }

  return items.map((item) => (
    <button className="vault-row" key={item.name} onClick={() => onOpen(item)}>
      <span className="vault-row-name">
        {isWiki ? item.name.replace(/\.md$/, '').replace(/[-_]/g, ' ') : item.name}
      </span>
      <span className="vault-row-date">{formatRelativeDate(item.mtime)}</span>
    </button>
  ));
}

export default function VaultView({ active, vaultVersion, onVaultChanged, searchTrigger }) {
  const [subView, setSubView] = useState('files');
  const [data, setData] = useState({ wiki: [], sources: [] });
  const [search, setSearch] = useState('');
  const [contentResults, setContentResults] = useState(null);
  const [openFile, setOpenFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [gitLog, setGitLog] = useState([]);
  const [openCommit, setOpenCommit] = useState(null);
  const [diffContent, setDiffContent] = useState('');
  const [trash, setTrash] = useState({ wiki: [], sources: [] });
  const searchInputRef = useRef(null);
  const showToast = useToast();

  useEffect(() => {
    if (!active) return;
    (async () => setData(await window.claudeAPI.getVault()))();
  }, [active, vaultVersion]);

  useEffect(() => {
    if (searchTrigger) searchInputRef.current?.focus();
  }, [searchTrigger]);

  useEffect(() => {
    if (!active || subView !== 'git') return;
    (async () => setGitLog(await window.claudeAPI.getGitLog()))();
  }, [active, subView, vaultVersion]);

  useEffect(() => {
    if (!active || subView !== 'trash') return;
    (async () => setTrash(await window.claudeAPI.listTrash()))();
  }, [active, subView, vaultVersion]);

  useEffect(() => {
    setContentResults(null);
  }, [search]);

  async function openItem(type, item) {
    setOpenFile({ type, name: item.name });
    setFileContent('Lade...');
    const content = await window.claudeAPI.getVaultFile(type, item.name);
    setFileContent(content ?? 'Datei konnte nicht gelesen werden.');
  }

  async function refreshVault() {
    setData(await window.claudeAPI.getVault());
  }

  async function searchContent() {
    if (!search.trim()) return;
    setContentResults(await window.claudeAPI.searchVault(search.trim()));
  }

  async function renameFile() {
    const newName = window.prompt('Neuer Dateiname:', openFile.name);
    if (!newName || newName === openFile.name) return;
    try {
      await window.claudeAPI.renameVaultFile(openFile.type, openFile.name, newName);
      showToast('Datei umbenannt.', 'success');
      setOpenFile(null);
      refreshVault();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteFile() {
    if (!window.confirm(`"${openFile.name}" in den Papierkorb verschieben?`)) return;
    try {
      await window.claudeAPI.deleteVaultFile(openFile.type, openFile.name);
      showToast('In den Papierkorb verschoben.', 'success');
      setOpenFile(null);
      refreshVault();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function restoreFromTrash(type, name) {
    try {
      await window.claudeAPI.restoreVaultFile(type, name);
      showToast('Datei wiederhergestellt.', 'success');
      setTrash(await window.claudeAPI.listTrash());
      refreshVault();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function emptyTrash() {
    if (!window.confirm('Papierkorb endgültig leeren? Das kann nicht rückgängig gemacht werden.')) return;
    await window.claudeAPI.emptyTrash();
    setTrash({ wiki: [], sources: [] });
    showToast('Papierkorb geleert.', 'success');
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files];
    if (!files.length) return;

    let imported = 0;
    for (const file of files) {
      try {
        const filePath = window.claudeAPI.getPathForFile(file);
        if (filePath) {
          await window.claudeAPI.importFile(filePath);
          imported++;
        }
      } catch {
        // skip files without a resolvable filesystem path
      }
    }

    if (imported) {
      showToast(`${imported} Datei(en) importiert.`, 'success');
      refreshVault();
      onVaultChanged();
    } else {
      showToast('Keine Datei konnte importiert werden.', 'error');
    }
  }

  async function openCommitDiff(commit) {
    setOpenCommit(commit);
    setDiffContent('Lade...');
    const diff = await window.claudeAPI.getGitDiff(commit.hash);
    setDiffContent(diff || 'Kein Diff verfügbar.');
  }

  const query = search.trim().toLowerCase();
  const filteredWiki = query ? data.wiki.filter((f) => f.name.toLowerCase().includes(query)) : data.wiki;
  const filteredSources = query ? data.sources.filter((f) => f.name.toLowerCase().includes(query)) : data.sources;

  return (
    <div id="vault-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Vault</div>
          <div id="greeting-sub">Was gerade in deinem Wiki steckt</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={searchInputRef}
            className="settings-input"
            style={{ width: 220 }}
            placeholder="Suchen... (Strg+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchContent()}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={searchContent} disabled={!search.trim()}>
            Inhalt durchsuchen
          </button>
        </div>
      </div>

      <div className="vault-subnav">
        <button
          className={`vault-subnav-btn ${subView === 'files' ? 'active' : ''}`}
          onClick={() => setSubView('files')}
        >
          Dateien
        </button>
        <button
          className={`vault-subnav-btn ${subView === 'graph' ? 'active' : ''}`}
          onClick={() => setSubView('graph')}
        >
          Graph
        </button>
        <button className={`vault-subnav-btn ${subView === 'git' ? 'active' : ''}`} onClick={() => setSubView('git')}>
          Git-Verlauf
        </button>
        <button
          className={`vault-subnav-btn ${subView === 'trash' ? 'active' : ''}`}
          onClick={() => setSubView('trash')}
        >
          Papierkorb
        </button>
      </div>

      {subView === 'files' && contentResults !== null ? (
        <div className="git-log-list">
          {contentResults.length === 0 && <div className="vault-empty">Keine Treffer im Inhalt gefunden.</div>}
          {contentResults.map((r) => (
            <button
              className="git-log-row"
              key={`${r.type}-${r.name}`}
              onClick={() => openItem(r.type, { name: r.name })}
            >
              <span className="git-log-hash">{r.type === 'wiki' ? 'Wiki' : 'Source'}</span>
              <span className="git-log-subject">
                <strong>{r.name}</strong> — …{r.snippet}…
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {subView === 'files' && contentResults === null && (
        <>
          <div id="vault-summary">
            <div className="vault-summary-item">
              <span className="vault-summary-value">{data.wiki.length}</span>
              <span className="vault-summary-label">Wiki-Themen</span>
            </div>
            <div className="vault-summary-item">
              <span className="vault-summary-value">{data.sources.length}</span>
              <span className="vault-summary-label">Rohquellen</span>
            </div>
          </div>

          <div id="vault-columns">
            <div className="vault-column">
              <div className="vault-column-label">Wiki-Themen</div>
              <div className="vault-list">
                <VaultList items={filteredWiki} isWiki onOpen={(item) => openItem('wiki', item)} />
              </div>
            </div>
            <div
              className={`vault-column ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="vault-column-label">Rohquellen (Dateien hierher ziehen zum Importieren)</div>
              <div className="vault-list">
                <VaultList items={filteredSources} isWiki={false} onOpen={(item) => openItem('sources', item)} />
              </div>
            </div>
          </div>
        </>
      )}

      {subView === 'graph' && (
        <WikiGraph
          active={active && subView === 'graph'}
          vaultVersion={vaultVersion}
          onOpenNode={(id) => openItem('wiki', { name: `${id}.md` })}
        />
      )}

      {subView === 'git' && (
        <div className="git-log-list">
          {gitLog.length === 0 && <div className="vault-empty">Kein Git-Verlauf gefunden.</div>}
          {gitLog.map((commit) => (
            <button className="git-log-row" key={commit.hash} onClick={() => openCommitDiff(commit)}>
              <span className="git-log-hash">{commit.hash}</span>
              <span className="git-log-date">{commit.date}</span>
              <span className="git-log-subject">{commit.subject}</span>
            </button>
          ))}
        </div>
      )}

      {subView === 'trash' && (
        <>
          <div id="vault-columns">
            <div className="vault-column">
              <div className="vault-column-label">Wiki-Themen</div>
              <div className="vault-list">
                {trash.wiki.length === 0 && <div className="vault-empty">Papierkorb leer.</div>}
                {trash.wiki.map((item) => (
                  <div className="vault-row" key={item.name} style={{ cursor: 'default' }}>
                    <span className="vault-row-name">{item.name}</span>
                    <button className="preset-btn" style={{ width: 'auto' }} onClick={() => restoreFromTrash('wiki', item.name)}>
                      Wiederherstellen
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="vault-column">
              <div className="vault-column-label">Rohquellen</div>
              <div className="vault-list">
                {trash.sources.length === 0 && <div className="vault-empty">Papierkorb leer.</div>}
                {trash.sources.map((item) => (
                  <div className="vault-row" key={item.name} style={{ cursor: 'default' }}>
                    <span className="vault-row-name">{item.name}</span>
                    <button className="preset-btn" style={{ width: 'auto' }} onClick={() => restoreFromTrash('sources', item.name)}>
                      Wiederherstellen
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {(trash.wiki.length > 0 || trash.sources.length > 0) && (
            <button className="danger-btn" style={{ marginTop: 12, alignSelf: 'flex-start' }} onClick={emptyTrash}>
              Papierkorb leeren
            </button>
          )}
        </>
      )}

      {openFile && (
        <Modal
          title={openFile.name}
          onClose={() => setOpenFile(null)}
          footer={
            <>
              <button className="preset-btn" style={{ width: 'auto' }} onClick={renameFile}>Umbenennen</button>
              <button className="danger-btn" onClick={deleteFile}>In Papierkorb</button>
            </>
          }
        >
          {openFile.name.endsWith('.md') ? (
            <ReactMarkdown>{fileContent}</ReactMarkdown>
          ) : (
            <pre className="modal-plain">{fileContent}</pre>
          )}
        </Modal>
      )}

      {openCommit && (
        <Modal title={`${openCommit.hash} — ${openCommit.subject}`} onClose={() => setOpenCommit(null)}>
          <pre className="modal-plain">{diffContent}</pre>
        </Modal>
      )}
    </div>
  );
}
