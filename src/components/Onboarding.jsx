import { useState } from 'react';

export default function Onboarding({ vaultName, onComplete }) {
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
        <h1>Willkommen</h1>
        <p>
          Wähle deinen Obsidian-Vault-Ordner, um loszulegen. Er sollte (oder wird) die Unterordner{' '}
          <code>wiki/</code> und <code>raw-sources/</code> enthalten.
        </p>
        <div className="settings-vault-row">
          <input
            className="settings-input settings-input-path"
            placeholder="Pfad zu deinem Vault"
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={browse}>
            Durchsuchen
          </button>
        </div>
        <button
          className="preset-btn"
          style={{ width: 'auto', marginTop: 18, padding: '10px 20px' }}
          onClick={finish}
          disabled={!vaultPath.trim()}
        >
          Loslegen
        </button>
      </div>
    </div>
  );
}
