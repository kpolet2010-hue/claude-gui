import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Modal from './Modal.jsx';
import WikiGraph from './WikiGraph.jsx';
import { useToast } from './ToastContext.jsx';
import { useT } from '../i18n.jsx';

function formatRelativeDate(iso, t) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return t('date.today');
  if (days === 1) return t('date.yesterday');
  return t('date.daysAgo', { count: days });
}

function VaultList({ items, isWiki, pinned, onOpen, onTogglePin, t }) {
  if (!items.length) {
    return <div className="vault-empty">{t('vault.noFiles')}</div>;
  }

  return items.map((item) => {
    const isPinned = pinned.includes(item.name);
    return (
      <div className={`vault-row ${isPinned ? 'pinned' : ''}`} key={item.name}>
        <button className="vault-row-pin" onClick={() => onTogglePin(item.name)} title={isPinned ? t('vault.unpin') : t('vault.pin')}>
          {isPinned ? '★' : '☆'}
        </button>
        <button className="vault-row-open" onClick={() => onOpen(item)}>
          <span className="vault-row-name">
            {isWiki ? item.name.replace(/\.md$/, '').replace(/[-_]/g, ' ') : item.name}
          </span>
          <span className="vault-row-date">{formatRelativeDate(item.mtime, t)}</span>
        </button>
      </div>
    );
  });
}

export default function VaultView({ active, vaultVersion, onVaultChanged, searchTrigger }) {
  const t = useT();
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
  const [pins, setPins] = useState({ wiki: [], sources: [] });
  const searchInputRef = useRef(null);
  const showToast = useToast();

  useEffect(() => {
    if (!active) return;
    (async () => setData(await window.claudeAPI.getVault()))();
    (async () => {
      const config = await window.claudeAPI.getConfig();
      setPins(config.pins || { wiki: [], sources: [] });
    })();
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

  async function togglePin(category, name) {
    setPins((prev) => {
      const list = prev[category] || [];
      const next = list.includes(name) ? list.filter((n) => n !== name) : [...list, name];
      return { ...prev, [category]: next };
    });
    await window.claudeAPI.togglePin(category, name);
  }

  async function openItem(type, item) {
    setOpenFile({ type, name: item.name });
    setFileContent(t('sessions.loading'));
    const content = await window.claudeAPI.getVaultFile(type, item.name);
    setFileContent(content ?? t('vault.readError'));
  }

  async function refreshVault() {
    setData(await window.claudeAPI.getVault());
  }

  async function searchContent() {
    if (!search.trim()) return;
    setContentResults(await window.claudeAPI.searchVault(search.trim()));
  }

  async function renameFile() {
    const newName = window.prompt(t('vault.renamePrompt'), openFile.name);
    if (!newName || newName === openFile.name) return;
    try {
      await window.claudeAPI.renameVaultFile(openFile.type, openFile.name, newName);
      showToast(t('vault.renameSuccess'), 'success');
      setOpenFile(null);
      refreshVault();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteFile() {
    if (!window.confirm(t('vault.toTrashConfirm', { name: openFile.name }))) return;
    try {
      await window.claudeAPI.deleteVaultFile(openFile.type, openFile.name);
      showToast(t('vault.toTrashSuccess'), 'success');
      setOpenFile(null);
      refreshVault();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function restoreFromTrash(type, name) {
    try {
      await window.claudeAPI.restoreVaultFile(type, name);
      showToast(t('vault.restoreSuccess'), 'success');
      setTrash(await window.claudeAPI.listTrash());
      refreshVault();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function emptyTrash() {
    if (!window.confirm(t('vault.emptyTrashConfirm'))) return;
    await window.claudeAPI.emptyTrash();
    setTrash({ wiki: [], sources: [] });
    showToast(t('vault.emptyTrashDone'), 'success');
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
      showToast(t('vault.importSuccess', { count: imported }), 'success');
      refreshVault();
      onVaultChanged();
    } else {
      showToast(t('vault.importFail'), 'error');
    }
  }

  async function openCommitDiff(commit) {
    setOpenCommit(commit);
    setDiffContent(t('sessions.loading'));
    const diff = await window.claudeAPI.getGitDiff(commit.hash);
    setDiffContent(diff || t('vault.noDiff'));
  }

  function sortPinnedFirst(items, category) {
    const list = pins[category] || [];
    return [...items].sort((a, b) => list.includes(b.name) - list.includes(a.name));
  }

  const query = search.trim().toLowerCase();
  const filteredWiki = sortPinnedFirst(
    query ? data.wiki.filter((f) => f.name.toLowerCase().includes(query)) : data.wiki,
    'wiki'
  );
  const filteredSources = sortPinnedFirst(
    query ? data.sources.filter((f) => f.name.toLowerCase().includes(query)) : data.sources,
    'sources'
  );

  return (
    <div id="vault-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">{t('vault.title')}</div>
          <div id="greeting-sub">{t('vault.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={searchInputRef}
            className="settings-input"
            style={{ width: 220 }}
            placeholder={t('vault.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchContent()}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={searchContent} disabled={!search.trim()}>
            {t('vault.searchContent')}
          </button>
        </div>
      </div>

      <div className="vault-subnav">
        <button
          className={`vault-subnav-btn ${subView === 'files' ? 'active' : ''}`}
          onClick={() => setSubView('files')}
        >
          {t('vault.tabFiles')}
        </button>
        <button
          className={`vault-subnav-btn ${subView === 'graph' ? 'active' : ''}`}
          onClick={() => setSubView('graph')}
        >
          {t('vault.tabGraph')}
        </button>
        <button className={`vault-subnav-btn ${subView === 'git' ? 'active' : ''}`} onClick={() => setSubView('git')}>
          {t('vault.tabGit')}
        </button>
        <button
          className={`vault-subnav-btn ${subView === 'trash' ? 'active' : ''}`}
          onClick={() => setSubView('trash')}
        >
          {t('vault.tabTrash')}
        </button>
      </div>

      {subView === 'files' && contentResults !== null ? (
        <div className="git-log-list">
          {contentResults.length === 0 && <div className="vault-empty">{t('vault.noContentMatches')}</div>}
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
              <span className="vault-summary-label">{t('vault.wikiTopics')}</span>
            </div>
            <div className="vault-summary-item">
              <span className="vault-summary-value">{data.sources.length}</span>
              <span className="vault-summary-label">{t('vault.rawSources')}</span>
            </div>
          </div>

          <div id="vault-columns">
            <div className="vault-column">
              <div className="vault-column-label">{t('vault.wikiTopics')}</div>
              <div className="vault-list">
                <VaultList
                  items={filteredWiki}
                  isWiki
                  pinned={pins.wiki || []}
                  onOpen={(item) => openItem('wiki', item)}
                  onTogglePin={(name) => togglePin('wiki', name)}
                  t={t}
                />
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
              <div className="vault-column-label">{t('vault.sourcesDropHint')}</div>
              <div className="vault-list">
                <VaultList
                  items={filteredSources}
                  isWiki={false}
                  pinned={pins.sources || []}
                  onOpen={(item) => openItem('sources', item)}
                  onTogglePin={(name) => togglePin('sources', name)}
                  t={t}
                />
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
          {gitLog.length === 0 && <div className="vault-empty">{t('vault.noGitLog')}</div>}
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
              <div className="vault-column-label">{t('vault.wikiTopics')}</div>
              <div className="vault-list">
                {trash.wiki.length === 0 && <div className="vault-empty">{t('vault.trashEmpty')}</div>}
                {trash.wiki.map((item) => (
                  <div className="vault-row" key={item.name} style={{ cursor: 'default' }}>
                    <span className="vault-row-name">{item.name}</span>
                    <button className="preset-btn" style={{ width: 'auto' }} onClick={() => restoreFromTrash('wiki', item.name)}>
                      {t('vault.restore')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="vault-column">
              <div className="vault-column-label">{t('vault.rawSources')}</div>
              <div className="vault-list">
                {trash.sources.length === 0 && <div className="vault-empty">{t('vault.trashEmpty')}</div>}
                {trash.sources.map((item) => (
                  <div className="vault-row" key={item.name} style={{ cursor: 'default' }}>
                    <span className="vault-row-name">{item.name}</span>
                    <button className="preset-btn" style={{ width: 'auto' }} onClick={() => restoreFromTrash('sources', item.name)}>
                      {t('vault.restore')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {(trash.wiki.length > 0 || trash.sources.length > 0) && (
            <button className="danger-btn" style={{ marginTop: 12, alignSelf: 'flex-start' }} onClick={emptyTrash}>
              {t('vault.emptyTrash')}
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
              <button className="preset-btn" style={{ width: 'auto' }} onClick={renameFile}>{t('vault.rename')}</button>
              <button className="danger-btn" onClick={deleteFile}>{t('vault.toTrash')}</button>
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
