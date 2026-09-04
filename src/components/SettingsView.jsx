import { useEffect, useState } from 'react';
import { useToast } from './ToastContext.jsx';
import { useT, useLanguage } from '../i18n.jsx';

const emptyConfig = {
  vaults: [],
  activeVault: '',
  autoSync: { enabled: false, intervalMinutes: 60, runOnStartup: false },
  theme: 'sunset',
  model: '',
  customActions: [],
  chatPresets: [],
};

const THEMES = [
  { id: 'sunset', label: 'Sunset', swatch: '#c96442' },
  { id: 'midnight', label: 'Midnight', swatch: '#5b6ee8' },
  { id: 'forest', label: 'Forest', swatch: '#3f9d72' },
  { id: 'obsidian', label: 'Obsidian', swatch: '#8875ff' },
  { id: 'light', label: 'Light', swatch: '#c96442' },
];

const MODELS = [
  { id: '', label: 'Standard (CLI-Default)' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
  { id: 'haiku', label: 'Haiku' },
];

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
];

export default function SettingsView({ active, onVaultChanged, onActionsChanged, onPresetsChanged }) {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const [config, setConfig] = useState(emptyConfig);
  const [edits, setEdits] = useState({});
  const [newVault, setNewVault] = useState({ name: '', path: '' });
  const [actionEdits, setActionEdits] = useState({});
  const [newAction, setNewAction] = useState({ label: '', prompt: '' });
  const [presetEdits, setPresetEdits] = useState({});
  const [newPreset, setNewPreset] = useState({ label: '', systemPrompt: '' });
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [autoLaunch, setAutoLaunchState] = useState(false);
  const [userName, setUserNameDraft] = useState('');
  const showToast = useToast();

  useEffect(() => {
    if (!active) return;
    (async () => {
      const fresh = await window.claudeAPI.getConfig();
      setConfig(fresh);
      setUserNameDraft(fresh.userName || '');
    })();
    (async () => setAppVersion(await window.claudeAPI.getAppVersion()))();
    (async () => setAutoLaunchState(await window.claudeAPI.getAutoLaunch()))();
  }, [active]);

  async function saveUserName() {
    const updated = await window.claudeAPI.setUserName(userName.trim());
    setConfig(updated);
  }

  useEffect(() => {
    window.claudeAPI.onUpdateStatus((data) => {
      setUpdateStatus(data);
      if (data.status !== 'checking') setCheckingUpdate(false);
    });
  }, []);

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
      showToast(t('settings.vaultSaved'), 'success');
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
      showToast(t('settings.vaultAdded'), 'success');
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
      showToast(t('settings.actionSaved'), 'success');
      onActionsChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteAction(id) {
    if (!window.confirm(t('settings.actionDeleteConfirm'))) return;
    const updated = await window.claudeAPI.removeAction(id);
    setConfig(updated);
    onActionsChanged();
  }

  async function addAction() {
    if (!newAction.label.trim() || !newAction.prompt.trim()) return;
    const updated = await window.claudeAPI.addAction(newAction.label.trim(), newAction.prompt.trim());
    setConfig(updated);
    setNewAction({ label: '', prompt: '' });
    showToast(t('settings.actionAdded'), 'success');
    onActionsChanged();
  }

  function editPresetField(id, field, value) {
    setPresetEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function presetFieldValue(preset, field) {
    return presetEdits[preset.id]?.[field] ?? preset[field];
  }

  async function savePreset(preset) {
    try {
      const updated = await window.claudeAPI.updatePreset(
        preset.id,
        presetFieldValue(preset, 'label'),
        presetFieldValue(preset, 'systemPrompt')
      );
      setConfig(updated);
      setPresetEdits((prev) => ({ ...prev, [preset.id]: undefined }));
      showToast(t('settings.presetSaved'), 'success');
      onPresetsChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deletePreset(id) {
    if (!window.confirm(t('settings.presetDeleteConfirm'))) return;
    const updated = await window.claudeAPI.removePreset(id);
    setConfig(updated);
    onPresetsChanged();
  }

  async function addPreset() {
    if (!newPreset.label.trim() || !newPreset.systemPrompt.trim()) return;
    const updated = await window.claudeAPI.addPreset(newPreset.label.trim(), newPreset.systemPrompt.trim());
    setConfig(updated);
    setNewPreset({ label: '', systemPrompt: '' });
    showToast(t('settings.presetAdded'), 'success');
    onPresetsChanged();
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    const result = await window.claudeAPI.checkForAppUpdates();
    if (result.status === 'dev-mode') {
      setUpdateStatus({ status: 'dev-mode' });
      setCheckingUpdate(false);
    }
  }

  async function handleInstallUpdate() {
    await window.claudeAPI.installUpdate();
  }

  async function toggleAutoLaunch(enabled) {
    setAutoLaunchState(await window.claudeAPI.setAutoLaunch(enabled));
  }

  async function handleExportConfig() {
    const saved = await window.claudeAPI.exportConfig();
    if (saved) showToast(t('settings.configExported'), 'success');
  }

  async function handleImportConfig() {
    try {
      const updated = await window.claudeAPI.importConfig();
      if (!updated) return;
      setConfig(updated);
      document.documentElement.setAttribute('data-theme', updated.theme || 'sunset');
      showToast(t('settings.configImported'), 'success');
      onVaultChanged();
      onActionsChanged();
      onPresetsChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div id="settings-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">{t('settings.title')}</div>
          <div id="greeting-sub">{t('settings.subtitle')}</div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.profileTitle')}</div>
        <div className="settings-hint" style={{ marginBottom: 10 }}>{t('settings.yourNameHint')}</div>
        <input
          className="settings-input"
          style={{ width: 260 }}
          placeholder={t('settings.namePlaceholderProfile')}
          value={userName}
          onChange={(e) => setUserNameDraft(e.target.value)}
          onBlur={saveUserName}
        />
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.vaults')}</div>

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
                {t('settings.browse')}
              </button>
              <button className="preset-btn" style={{ width: 'auto' }} onClick={() => saveVault(vault)}>
                {t('settings.save')}
              </button>
              {config.activeVault === vault.name ? (
                <span className="settings-active-badge">{t('settings.active')}</span>
              ) : (
                <button className="preset-btn" style={{ width: 'auto' }} onClick={() => activateVault(vault.name)}>
                  {t('settings.activate')}
                </button>
              )}
              <button
                className="danger-btn"
                disabled={config.vaults.length <= 1}
                onClick={() => deleteVault(vault.name)}
              >
                {t('settings.delete')}
              </button>
            </div>
          ))}
        </div>

        <div className="settings-vault-row settings-vault-new">
          <input
            className="settings-input"
            placeholder={t('settings.namePlaceholder')}
            value={newVault.name}
            onChange={(e) => setNewVault((v) => ({ ...v, name: e.target.value }))}
          />
          <input
            className="settings-input settings-input-path"
            placeholder={t('settings.pathPlaceholder')}
            value={newVault.path}
            onChange={(e) => setNewVault((v) => ({ ...v, path: e.target.value }))}
          />
          <button
            className="preset-btn"
            style={{ width: 'auto' }}
            onClick={() => browseForPath((p) => setNewVault((v) => ({ ...v, path: p })))}
          >
            {t('settings.browse')}
          </button>
          <button className="preset-btn" style={{ width: 'auto' }} onClick={addVault}>
            {t('settings.addVault')}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.design')}</div>
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
        <div className="settings-section-label">{t('settings.language')}</div>
        <div className="settings-theme-list">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              className={`settings-theme-swatch ${language === lang.id ? 'active' : ''}`}
              onClick={() => setLanguage(lang.id)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.model')}</div>
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
        <div className="settings-section-label">{t('settings.actionsTitle')}</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>
          <code>{'{input}'}</code> {t('settings.actionsHint').replace('{input}', '').trim()}
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
                {t('settings.save')}
              </button>
              <button className="danger-btn" onClick={() => deleteAction(action.id)}>{t('settings.delete')}</button>
            </div>
          </div>
        ))}

        <div className="settings-action-row">
          <input
            className="settings-input"
            placeholder={t('settings.actionButtonName')}
            value={newAction.label}
            onChange={(e) => setNewAction((a) => ({ ...a, label: e.target.value }))}
          />
          <textarea
            className="settings-textarea"
            placeholder={t('settings.actionPromptPlaceholder')}
            value={newAction.prompt}
            onChange={(e) => setNewAction((a) => ({ ...a, prompt: e.target.value }))}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={addAction}>
            {t('settings.addAction')}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.presetsTitle')}</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>{t('settings.presetsHint')}</div>

        {config.chatPresets.map((preset) => (
          <div className="settings-action-row" key={preset.id}>
            <input
              className="settings-input"
              value={presetFieldValue(preset, 'label')}
              onChange={(e) => editPresetField(preset.id, 'label', e.target.value)}
            />
            <textarea
              className="settings-textarea"
              value={presetFieldValue(preset, 'systemPrompt')}
              onChange={(e) => editPresetField(preset.id, 'systemPrompt', e.target.value)}
            />
            <div className="settings-action-buttons">
              <button className="preset-btn" style={{ width: 'auto' }} onClick={() => savePreset(preset)}>
                {t('settings.save')}
              </button>
              <button className="danger-btn" onClick={() => deletePreset(preset.id)}>{t('settings.delete')}</button>
            </div>
          </div>
        ))}

        <div className="settings-action-row">
          <input
            className="settings-input"
            placeholder={t('settings.presetName')}
            value={newPreset.label}
            onChange={(e) => setNewPreset((p) => ({ ...p, label: e.target.value }))}
          />
          <textarea
            className="settings-textarea"
            placeholder={t('settings.presetPromptPlaceholder')}
            value={newPreset.systemPrompt}
            onChange={(e) => setNewPreset((p) => ({ ...p, systemPrompt: e.target.value }))}
          />
          <button className="preset-btn" style={{ width: 'auto' }} onClick={addPreset}>
            {t('settings.addPreset')}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.startTitle')}</div>
        <label className="settings-checkbox-row">
          <input type="checkbox" checked={autoLaunch} onChange={(e) => toggleAutoLaunch(e.target.checked)} />
          {t('settings.autoLaunch')}
        </label>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.autoSyncTitle')}</div>

        <label className="settings-checkbox-row">
          <input
            type="checkbox"
            checked={config.autoSync.runOnStartup}
            onChange={(e) => saveAutoSync({ runOnStartup: e.target.checked })}
          />
          {t('settings.autoSyncStartup')}
        </label>

        <label className="settings-checkbox-row">
          <input
            type="checkbox"
            checked={config.autoSync.enabled}
            onChange={(e) => saveAutoSync({ enabled: e.target.checked })}
          />
          {t('settings.autoSyncInterval')}
          <input
            type="number"
            min="1"
            className="settings-input settings-input-number"
            value={config.autoSync.intervalMinutes}
            onChange={(e) => saveAutoSync({ intervalMinutes: parseInt(e.target.value) || 1 })}
          />
          {t('settings.autoSyncMinutes')}
        </label>

        <div className="settings-hint">{t('settings.autoSyncHint')}</div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.backupTitle')}</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>{t('settings.backupHint')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="preset-btn" style={{ width: 'auto' }} onClick={handleExportConfig}>
            {t('settings.exportConfig')}
          </button>
          <button className="preset-btn" style={{ width: 'auto' }} onClick={handleImportConfig}>
            {t('settings.importConfig')}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-label">{t('settings.about')}</div>
        <div className="settings-hint" style={{ marginBottom: 12 }}>{t('settings.version', { version: appVersion || '–' })}</div>
        <button className="preset-btn" style={{ width: 'auto' }} onClick={handleCheckUpdate} disabled={checkingUpdate}>
          {checkingUpdate ? t('settings.checkingUpdate') : t('settings.checkUpdate')}
        </button>
        {updateStatus && (
          <div className="settings-hint" style={{ marginTop: 10 }}>
            {updateStatus.status === 'dev-mode' && t('settings.updateDevMode')}
            {updateStatus.status === 'not-available' && t('settings.upToDate')}
            {updateStatus.status === 'available' && t('settings.updateAvailable', { version: updateStatus.version })}
            {updateStatus.status === 'downloading' && t('settings.updateDownloading', { percent: updateStatus.percent })}
            {updateStatus.status === 'error' && t('settings.updateError', { message: updateStatus.message })}
            {updateStatus.status === 'downloaded' && (
              <>
                {t('settings.updateDownloaded', { version: updateStatus.version })}{' '}
                <button className="preset-btn" style={{ width: 'auto', marginTop: 8 }} onClick={handleInstallUpdate}>
                  {t('settings.installUpdate')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
