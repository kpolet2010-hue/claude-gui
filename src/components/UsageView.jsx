import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n.jsx';

export default function UsageView({ active, vaultVersion }) {
  const t = useT();
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    const result = await window.claudeAPI.getUsage();
    setRaw(result || t('usage.noData'));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (active) loadUsage();
  }, [active, vaultVersion, loadUsage]);

  const percentMatches = raw.match(/(\d{1,3})\s*%/g);
  const p1 = percentMatches?.[0] ? parseInt(percentMatches[0]) : null;
  const p2 = percentMatches?.[1] ? parseInt(percentMatches[1]) : null;
  const resetMatch = raw.match(/reset[s]?\s*(in|at)?\s*[:\-]?\s*(.+)/i);
  const resetText = resetMatch ? resetMatch[0].slice(0, 60) : t('usage.seeRaw');

  return (
    <div id="usage-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">{t('usage.title')}</div>
          <div id="greeting-sub">{t('usage.subtitle')}</div>
        </div>
        <button id="refreshUsage" className="preset-btn" style={{ width: 'auto', padding: '10px 16px' }} onClick={loadUsage}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6M4 13a8 8 0 0 0 13.7 4.7L20 15.4"/><path d="M4 4v4.6h4.6M20 20v-4.6h-4.6"/></svg>
          {t('usage.refresh')}
        </button>
      </div>

      <div id="usage-cards">
        <div className="usage-card">
          <div className="usage-card-label">{t('usage.sessionWindow')}</div>
          <div className="usage-bar-track">
            <div className="usage-bar-fill" style={{ width: `${p1 ?? 0}%` }}></div>
          </div>
          <div className="usage-card-value">{p1 !== null ? t('usage.percentUsed', { percent: p1 }) : t('usage.seeRaw')}</div>
        </div>

        <div className="usage-card">
          <div className="usage-card-label">{t('usage.weeklyLimit')}</div>
          <div className="usage-bar-track">
            <div className="usage-bar-fill" style={{ width: `${p2 ?? 0}%` }}></div>
          </div>
          <div className="usage-card-value">{p2 !== null ? t('usage.percentUsed', { percent: p2 }) : t('usage.seeRaw')}</div>
        </div>

        <div className="usage-card">
          <div className="usage-card-label">{t('usage.nextReset')}</div>
          <div className="usage-card-value">{resetText}</div>
        </div>
      </div>

      <div id="usage-raw-label">{t('usage.rawLabel')}</div>
      <div id="usage-raw">{loading ? t('usage.loading') : raw}</div>
    </div>
  );
}
