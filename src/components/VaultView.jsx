import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Modal from './Modal.jsx';
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
  const [openFile, setOpenFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [gitLog, setGitLog] = useState([]);
  const [openCommit, setOpenCommit] = useState(null);
  const [diffContent, setDiffContent] = useState('');
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

  async function openItem(type, item) {
    setOpenFile({ type, name: item.name });
    setFileContent('Lade...');
    const content = await window.claudeAPI.getVaultFile(type, item.name);
    setFileContent(content ?? 'Datei konnte nicht gelesen werden.');
  }

  async function refreshVault() {
    setData(await window.claudeAPI.getVault());
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
    if (!window.confirm(`"${openFile.name}" wirklich löschen?`)) return;
    try {
      await window.claudeAPI.deleteVaultFile(openFile.type, openFile.name);
      showToast('Datei gelöscht.', 'success');
      setOpenFile(null);
      refreshVault();
    } catch (err) {
      showToast(err.message, 'error');
    }
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
        <input
          ref={searchInputRef}
          className="settings-input"
          style={{ width: 220 }}
          placeholder="Suchen... (Strg+K)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="vault-subnav">
        <button
          className={`vault-subnav-btn ${subView === 'files' ? 'active' : ''}`}
          onClick={() => setSubView('files')}
        >
          Dateien
        </button>
        <button className={`vault-subnav-btn ${subView === 'git' ? 'active' : ''}`} onClick={() => setSubView('git')}>
          Git-Verlauf
        </button>
      </div>

      {subView === 'files' ? (
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
      ) : (
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

      {openFile && (
        <Modal
          title={openFile.name}
          onClose={() => setOpenFile(null)}
          footer={
            <>
              <button className="preset-btn" style={{ width: 'auto' }} onClick={renameFile}>Umbenennen</button>
              <button className="danger-btn" onClick={deleteFile}>Löschen</button>
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
