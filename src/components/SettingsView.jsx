import { useEffect, useState } from 'react';
import { useToast } from './ToastContext.jsx';

const emptyConfig = {
  vaults: [],
  activeVault: '',
  autoSync: { enabled: false, intervalMinutes: 60, runOnStartup: false },
  theme: 'sunset',
  model: '',
  customActions: [],
};

const THEMES = [
  { id: 'sunset', label: 'Sunset', swatch: '#c96442' },
  { id: 'midnight', label: 'Midnight', swatch: '#5b6ee8' },
  { id: 'forest', label: 'Forest', swatch: '#3f9d72' },
  { id: 'light', label: 'Light', swatch: '#c96442' },
];

const MODELS = [
  { id: '', label: 'Standard (CLI-Default)' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
  { id: 'haiku', label: 'Haiku' },
];

export default function SettingsView({ active, onVaultChanged, onActionsChanged }) {
  const [config, setConfig] = useState(emptyConfig);
  const [edits, setEdits] = useState({});
  const [newVault, setNewVault] = useState({ name: '', path: '' });
  const [actionEdits, setActionEdits] = useState({});
  const [newAction, setNewAction] = useState({ label: '', prompt: '' });
  const showToast = useToast();

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
      showToast('Vault gespeichert.', 'success');
      onVaultChanged();
    } catch (err) {
      showToast(err.message, 'error');
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
      showToast(err.message, 'error');
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
      showToast('Vault hinzugefügt.', 'success');
      onVaultChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function saveAutoSync(patch) {
    const updated = await window.claudeAPI.updateAutoSync({ ...config.autoSync, ...patch });
    setConfig(updated);
  }

  async function selectTheme(themeId) {
    document.documentElement.setAttribute('data-theme', themeId);
    const updated = await window.claudeAPI.setTheme(themeId);
    setConfig(updated);
  }

  async function selectModel(modelId) {
    const updated = await window.claudeAPI.setModel(modelId);
    setConfig(updated);
  }

  function editActionField(id, field, value) {
    setActionEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function actionFieldValue(action, field) {
    return actionEdits[action.id]?.[field] ?? action[field];
  }

  async function saveAction(action) {
    try {
      const updated = await window.claudeAPI.updateAction(
        action.id,
        actionFieldValue(action, 'label'),
        actionFieldValue(action, 'prompt')
      );
      setConfig(updated);
      setActionEdits((prev) => ({ ...prev, [action.id]: undefined }));
      showToast('Aktion gespeichert.', 'success');
      onActionsChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteAction(id) {
    if (!window.confirm('Diese Aktion wirklich löschen?')) return;
    const updated = await window.claudeAPI.removeAction(id);
    setConfig(updated);
    onActionsChanged();
  }

  async function addAction() {
    if (!newAction.label.trim() || !newAction.prompt.trim()) return;
    const updated = await window.claudeAPI.addAction(newAction.label.trim(), newAction.prompt.trim());
    setConfig(updated);
    setNewAction({ label: '', prompt: '' });
    showToast('Aktion hinzugefügt.', 'success');
    onActionsChanged();
  }

  return (
    <div id="settings-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Einstellungen</div>
          <div id="greeting-sub">Vaults, Aktionen und Automatisierung konfigurieren</div>
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
        <div className="settings-section-label">Design</div>
        <div className="settings-theme-list">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              className={`settings-theme-swatch ${config.theme === theme.id ? 'active' : ''}`}
              onClick={() => selectTheme(theme.id)}
            >
              <span className="settings-theme-dot" style={{ background: theme.swatch }}></span>
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Modell</div>
        <div className="settings-theme-list">
          {MODELS.map((model) => (
            <button
              key={model.id}
              className={`settings-theme-swatch ${config.model === model.id ? 'active' : ''}`}
              onClick={() => selectModel(model.id)}
            >
              {model.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">Aktionen (Sidebar-Buttons)</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>
          <code>{'{input}'}</code> im Prompt fragt beim Klick per Dialog nach einem Wert (wie bei "Thema erweitern").
        </div>

        {config.customActions.map((action) => (
          <div className="settings-action-row" key={action.id}>
            <input
              className="settings-input"
              value={actionFieldValue(action, 'label')}
              onChange={(e) => editActionField(action.id, 'label', e.target.value)}
            />
            <textarea
              className="settings-textarea"
              value={actionFieldValue(action, 'prompt')}
              onChange={(e) => editActionField(action.id, 'prompt', e.target.value)}
            />
            <div className="settings-action-buttons">
              <button className="preset-btn" style={{ width: 'auto' }} onClick={() => saveAction(action)}>
                Speichern
              </button>
              <button className="danger-btn" onClick={() => deleteAction(action.id)}>Löschen</button>
            </div>
          </div>
        ))}

        <div className="settings-action-row">
          <input
            className="settings-input"
            placeholder="Name des Buttons"
            value={newAction.label}
            onChange={(e) => setNewAction((a) => ({ ...a, label: e.target.value }))}
          />
          <textarea
            className="settings-textarea"
            placeholder="Prompt-Text (optional mit {input})"
            value={newAction.prompt}
            onChange={(e) => setNewAction((a) => ({ ...a, prompt: e.target.value }))}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={addAction}>
            + Aktion hinzufügen
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
          Läuft im Hintergrund auf dem aktiven Vault (auch bei minimiertem Fenster/Tray). Änderungen an "Beim Start"
          gelten ab dem nächsten App-Start.
        </div>
      </div>
    </div>
  );
}
