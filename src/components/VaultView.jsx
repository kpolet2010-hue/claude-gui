import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Modal from './Modal.jsx';

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

export default function VaultView({ active, vaultVersion }) {
  const [data, setData] = useState({ wiki: [], sources: [] });
  const [openFile, setOpenFile] = useState(null);
  const [fileContent, setFileContent] = useState('');

  useEffect(() => {
    if (!active) return;
    (async () => setData(await window.claudeAPI.getVault()))();
  }, [active, vaultVersion]);

  async function openItem(type, item) {
    setOpenFile({ type, name: item.name });
    setFileContent('Lade...');
    const content = await window.claudeAPI.getVaultFile(type, item.name);
    setFileContent(content ?? 'Datei konnte nicht gelesen werden.');
  }

  return (
    <div id="vault-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Vault</div>
          <div id="greeting-sub">Was gerade in deinem Wiki steckt</div>
        </div>
      </div>

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
            <VaultList items={data.wiki} isWiki onOpen={(item) => openItem('wiki', item)} />
          </div>
        </div>
        <div className="vault-column">
          <div className="vault-column-label">Rohquellen</div>
          <div className="vault-list">
            <VaultList items={data.sources} isWiki={false} onOpen={(item) => openItem('sources', item)} />
          </div>
        </div>
      </div>

      {openFile && (
        <Modal title={openFile.name} onClose={() => setOpenFile(null)}>
          {openFile.name.endsWith('.md') ? (
            <ReactMarkdown>{fileContent}</ReactMarkdown>
          ) : (
            <pre className="modal-plain">{fileContent}</pre>
          )}
        </Modal>
      )}
    </div>
  );
}
