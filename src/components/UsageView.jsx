import { useCallback, useEffect, useState } from 'react';

export default function UsageView({ active, vaultVersion }) {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    const result = await window.claudeAPI.getUsage();
    setRaw(result || 'Keine Daten erhalten.');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (active) loadUsage();
  }, [active, vaultVersion, loadUsage]);

  const percentMatches = raw.match(/(\d{1,3})\s*%/g);
  const p1 = percentMatches?.[0] ? parseInt(percentMatches[0]) : null;
  const p2 = percentMatches?.[1] ? parseInt(percentMatches[1]) : null;
  const resetMatch = raw.match(/reset[s]?\s*(in|at)?\s*[:\-]?\s*(.+)/i);
  const resetText = resetMatch ? resetMatch[0].slice(0, 60) : 'Siehe Rohdaten unten';

  return (
    <div id="usage-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Nutzung</div>
          <div id="greeting-sub">Dein Claude Code Verbrauch</div>
        </div>
        <button id="refreshUsage" className="preset-btn" style={{ width: 'auto', padding: '10px 16px' }} onClick={loadUsage}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6M4 13a8 8 0 0 0 13.7 4.7L20 15.4"/><path d="M4 4v4.6h4.6M20 20v-4.6h-4.6"/></svg>
          Aktualisieren
        </button>
      </div>

      <div id="usage-cards">
        <div className="usage-card">
          <div className="usage-card-label">Session (5h Fenster)</div>
          <div className="usage-bar-track">
            <div className="usage-bar-fill" style={{ width: `${p1 ?? 0}%` }}></div>
          </div>
          <div className="usage-card-value">{p1 !== null ? `${p1}% genutzt` : 'Siehe Rohdaten unten'}</div>
        </div>

        <div className="usage-card">
          <div className="usage-card-label">Wochenlimit</div>
          <div className="usage-bar-track">
            <div className="usage-bar-fill" style={{ width: `${p2 ?? 0}%` }}></div>
          </div>
          <div className="usage-card-value">{p2 !== null ? `${p2}% genutzt` : 'Siehe Rohdaten unten'}</div>
        </div>

        <div className="usage-card">
          <div className="usage-card-label">Nächster Reset</div>
          <div className="usage-card-value">{resetText}</div>
        </div>
      </div>

      <div id="usage-raw-label">Rohdaten von Claude Code:</div>
      <div id="usage-raw">{loading ? 'Lade...' : raw}</div>
    </div>
  );
}
