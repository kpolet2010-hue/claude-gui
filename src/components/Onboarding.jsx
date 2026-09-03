import { useState } from 'react';
import { useT } from '../i18n.jsx';

export default function Onboarding({ vaultName, onComplete }) {
  const t = useT();
  const [vaultPath, setVaultPath] = useState('');

  async function browse() {
    const picked = await window.claudeAPI.pickFolder();
    if (picked) setVaultPath(picked);
  }

  async function finish() {
    if (!vaultPath.trim()) return;
    await window.claudeAPI.updateVault(vaultName, vaultName, vaultPath.trim());
    onComplete();
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div id="logo" style={{ marginBottom: 4 }}><span className="logo-mark"></span><span>Brain</span></div>
        <h1>{t('onboarding.title')}</h1>
        <p>
          {t('onboarding.description').split(/(wiki\/|raw-sources\/)/).map((part, i) =>
            part === 'wiki/' || part === 'raw-sources/' ? <code key={i}>{part}</code> : part
          )}
        </p>
        <div className="settings-vault-row">
          <input
            className="settings-input settings-input-path"
            placeholder={t('onboarding.pathPlaceholder')}
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={browse}>
            {t('settings.browse')}
          </button>
        </div>
        <button
          className="preset-btn"
          style={{ width: 'auto', marginTop: 18, padding: '10px 20px' }}
          onClick={finish}
          disabled={!vaultPath.trim()}
        >
          {t('onboarding.start')}
        </button>
      </div>
    </div>
  );
}
