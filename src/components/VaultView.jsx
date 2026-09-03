import { useEffect, useState } from 'react';

function formatRelativeDate(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

function VaultList({ items, isWiki }) {
  if (!items.length) {
    return <div className="vault-empty">Keine Dateien gefunden.</div>;
  }

  return items.map((item) => (
    <div className="vault-row" key={item.name}>
      <span className="vault-row-name">
        {isWiki ? item.name.replace(/\.md$/, '').replace(/[-_]/g, ' ') : item.name}
      </span>
      <span className="vault-row-date">{formatRelativeDate(item.mtime)}</span>
    </div>
  ));
}

export default function VaultView({ active }) {
  const [data, setData] = useState({ wiki: [], sources: [] });

  useEffect(() => {
    if (!active) return;
    (async () => setData(await window.claudeAPI.getVault()))();
  }, [active]);

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
          <div className="vault-list"><VaultList items={data.wiki} isWiki /></div>
        </div>
        <div className="vault-column">
          <div className="vault-column-label">Rohquellen</div>
          <div className="vault-list"><VaultList items={data.sources} isWiki={false} /></div>
        </div>
      </div>
    </div>
  );
}
