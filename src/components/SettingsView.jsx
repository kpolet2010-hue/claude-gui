import { useEffect, useState } from 'react';

const emptyConfig = { vaults: [], activeVault: '', autoSync: { enabled: false, intervalMinutes: 60, runOnStartup: false } };

export default function SettingsView({ active, onVaultChanged }) {
  const [config, setConfig] = useState(emptyConfig);
  const [edits, setEdits] = useState({});
  const [newVault, setNewVault] = useState({ name: '', path: '' });

  useEffect(() => {
    if (!active) return;
    (async () => setConfig(await window.claudeAPI.getConfig()))();
  }, [active]);

  function editField(name, field, value) {
    setEdits((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  }

  function fieldValue(vault, field) {
    return edits[vault.name]?.[field] ?? vault[field];
  }

  async function saveVault(vault) {
    try {
      const updated = await window.claudeAPI.updateVault(
        vault.name,
        fieldValue(vault, 'name'),
        fieldValue(vault, 'path')
      );
      setConfig(updated);
      setEdits((prev) => ({ ...prev, [vault.name]: undefined }));
      onVaultChanged();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function activateVault(name) {
    const updated = await window.claudeAPI.setActiveVault(name);
    setConfig(updated);
    onVaultChanged();
  }

  async function deleteVault(name) {
    try {
      const updated = await window.claudeAPI.removeVault(name);
      setConfig(updated);
      onVaultChanged();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function browseForPath(setter) {
    const picked = await window.claudeAPI.pickFolder();
    if (picked) setter(picked);
  }

  async function addVault() {
    if (!newVault.name.trim() || !newVault.path.trim()) return;
    try {
      const updated = await window.claudeAPI.addVault(newVault.name.trim(), newVault.path.trim());
      setConfig(updated);
      setNewVault({ name: '', path: '' });
      onVaultChanged();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function saveAutoSync(patch) {
    const updated = await window.claudeAPI.updateAutoSync({ ...config.autoSync, ...patch });
    setConfig(updated);
  }

  return (
    <div id="settings-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Einstellungen</div>
          <div id="greeting-sub">Vaults verwalten und Automatisierung konfigurieren</div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Vaults</div>

        <div className="settings-vault-list">
          {config.vaults.map((vault) => (
            <div className="settings-vault-row" key={vault.name}>
              <input
                className="settings-input"
                value={fieldValue(vault, 'name')}
                onChange={(e) => editField(vault.name, 'name', e.target.value)}
              />
              <input
                className="settings-input settings-input-path"
                value={fieldValue(vault, 'path')}
                onChange={(e) => editField(vault.name, 'path', e.target.value)}
              />
              <button
                className="preset-btn"
                style={{ width: 'auto' }}
                onClick={() => browseForPath((p) => editField(vault.name, 'path', p))}
              >
                Durchsuchen
              </button>
              <button className="preset-btn" style={{ width: 'auto' }} onClick={() => saveVault(vault)}>
                Speichern
              </button>
              {config.activeVault === vault.name ? (
                <span className="settings-active-badge">Aktiv</span>
              ) : (
                <button className="preset-btn" style={{ width: 'auto' }} onClick={() => activateVault(vault.name)}>
                  Aktivieren
                </button>
              )}
              <button
                className="danger-btn"
                disabled={config.vaults.length <= 1}
                onClick={() => deleteVault(vault.name)}
              >
                Löschen
              </button>
            </div>
          ))}
        </div>

        <div className="settings-vault-row settings-vault-new">
          <input
            className="settings-input"
            placeholder="Name"
            value={newVault.name}
            onChange={(e) => setNewVault((v) => ({ ...v, name: e.target.value }))}
          />
          <input
            className="settings-input settings-input-path"
            placeholder="Pfad"
            value={newVault.path}
            onChange={(e) => setNewVault((v) => ({ ...v, path: e.target.value }))}
          />
          <button
            className="preset-btn"
            style={{ width: 'auto' }}
            onClick={() => browseForPath((p) => setNewVault((v) => ({ ...v, path: p })))}
          >
            Durchsuchen
          </button>
          <button className="preset-btn" style={{ width: 'auto' }} onClick={addVault}>
            + Vault hinzufügen
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Automatisches Sync ("Neue Sources")</div>

        <label className="settings-checkbox-row">
          <input
            type="checkbox"
            checked={config.autoSync.runOnStartup}
            onChange={(e) => saveAutoSync({ runOnStartup: e.target.checked })}
          />
          Beim App-Start automatisch ausführen
        </label>

        <label className="settings-checkbox-row">
          <input
            type="checkbox"
            checked={config.autoSync.enabled}
            onChange={(e) => saveAutoSync({ enabled: e.target.checked })}
          />
          Regelmäßig automatisch ausführen, alle
          <input
            type="number"
            min="1"
            className="settings-input settings-input-number"
            value={config.autoSync.intervalMinutes}
            onChange={(e) => saveAutoSync({ intervalMinutes: parseInt(e.target.value) || 1 })}
          />
          Minuten
        </label>

        <div className="settings-hint">
          Läuft im Hintergrund über die Sidebar-Aktion "Neue Sources" auf dem aktiven Vault. Änderungen an "Beim Start"
          gelten ab dem nächsten App-Start.
        </div>
      </div>
    </div>
  );
}
