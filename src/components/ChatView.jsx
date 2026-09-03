import { useEffect, useRef, useState } from 'react';
import ChatBubble from './ChatBubble.jsx';
import { useToast } from './ToastContext.jsx';

const HISTORY_KEY = 'brain-prompt-history';
const MENTION_REGEX = /@([\w.-]+)/g;

function loadPromptHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePromptHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-50)));
  } catch {
    // ignore quota errors
  }
}

export default function ChatView({ active, messages, busy, onSend, onStop, onNewChat, vaultVersion }) {
  const [input, setInput] = useState('');
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [mentionOptions, setMentionOptions] = useState([]);
  const [vaultFiles, setVaultFiles] = useState([]);
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const promptHistoryRef = useRef(loadPromptHistory());
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');
  const showToast = useToast();

  useEffect(() => {
    if (!active) return;
    (async () => {
      const data = await window.claudeAPI.getVault();
      setVaultFiles([
        ...data.wiki.map((f) => ({ type: 'wiki', name: f.name })),
        ...data.sources.map((f) => ({ type: 'sources', name: f.name })),
      ]);
    })();
  }, [active, vaultVersion]);

  useEffect(() => {
    if (isAtBottomRef.current && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages]);

  function handleScroll() {
    const el = outputRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distance < 40;
    setShowJumpButton(!isAtBottomRef.current);
  }

  function jumpToBottom() {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    isAtBottomRef.current = true;
    setShowJumpButton(false);
  }

  function updateMentionSuggestions(value, cursorPos) {
    const before = value.slice(0, cursorPos);
    const match = before.match(/@([\w.-]*)$/);
    if (!match) {
      setMentionOptions([]);
      return;
    }
    const query = match[1].toLowerCase();
    const options = vaultFiles
      .filter((f) => {
        const base = f.type === 'wiki' ? f.name.replace(/\.md$/, '') : f.name;
        return base.toLowerCase().includes(query);
      })
      .slice(0, 6);
    setMentionOptions(options);
  }

  function handleInputChange(e) {
    const value = e.target.value;
    setInput(value);
    historyIndexRef.current = -1;
    updateMentionSuggestions(value, e.target.selectionStart);
  }

  function selectMention(file) {
    const base = file.type === 'wiki' ? file.name.replace(/\.md$/, '') : file.name;
    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, cursorPos).replace(/@([\w.-]*)$/, `@${base} `);
    const after = input.slice(cursorPos);
    setInput(before + after);
    setMentionOptions([]);
    inputRef.current?.focus();
  }

  function resolveMentionFile(name) {
    const lower = name.toLowerCase();
    return vaultFiles.find((f) => {
      const base = f.type === 'wiki' ? f.name.replace(/\.md$/, '') : f.name;
      return base.toLowerCase() === lower;
    });
  }

  async function buildAugmentedPrompt(text) {
    const names = [...text.matchAll(MENTION_REGEX)].map((m) => m[1]);
    if (!names.length) return text;

    const uniqueNames = [...new Set(names)];
    const blocks = [];
    for (const name of uniqueNames) {
      const file = resolveMentionFile(name);
      if (!file) continue;
      const content = await window.claudeAPI.getVaultFile(file.type, file.name);
      if (content) blocks.push(`--- Kontext aus @${name} ---\n${content}`);
    }
    if (!blocks.length) return text;
    return `${text}\n\n${blocks.join('\n\n')}`;
  }

  async function handleSend() {
    if (!input.trim()) return;
    const displayText = input;
    const augmented = await buildAugmentedPrompt(input);

    const history = promptHistoryRef.current;
    if (history[history.length - 1] !== displayText) {
      history.push(displayText);
      savePromptHistory(history);
    }
    historyIndexRef.current = -1;

    onSend(augmented, displayText);
    setInput('');
    setMentionOptions([]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleSend();
      return;
    }
    if (mentionOptions.length) return;

    const history = promptHistoryRef.current;
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      if (historyIndexRef.current === -1) draftRef.current = input;
      const nextIndex = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = nextIndex;
      setInput(history[history.length - 1 - nextIndex]);
    } else if (e.key === 'ArrowDown' && historyIndexRef.current !== -1) {
      e.preventDefault();
      const nextIndex = historyIndexRef.current - 1;
      historyIndexRef.current = nextIndex;
      setInput(nextIndex === -1 ? draftRef.current : history[history.length - 1 - nextIndex]);
    }
  }

  async function handleExport() {
    const markdown = messages
      .map((m) => `### ${m.role === 'user' ? 'Du' : m.role === 'error' ? 'Fehler' : 'Claude'}\n\n${m.text}`)
      .join('\n\n---\n\n');
    const saved = await window.claudeAPI.exportChat(markdown);
    if (saved) showToast('Chat exportiert.', 'success');
  }

  return (
    <div id="chat-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">Chat</div>
          <div id="greeting-sub">Was steht heute an?</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="preset-btn" style={{ width: 'auto', padding: '10px 16px' }} onClick={handleExport}>
            Exportieren
          </button>
          <button
            className="preset-btn"
            style={{ width: 'auto', padding: '10px 16px' }}
            onClick={onNewChat}
            disabled={busy}
          >
            Neuer Chat
          </button>
        </div>
      </div>

      <div className="chat-output-wrap">
        <div id="output" ref={outputRef} onScroll={handleScroll}>
          {messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role} text={msg.text} />
          ))}
        </div>
        {showJumpButton && (
          <button className="jump-to-bottom-btn" onClick={jumpToBottom}>
            ↓ Neue Nachrichten
          </button>
        )}
      </div>

      <div id="inputRow" style={{ position: 'relative' }}>
        {mentionOptions.length > 0 && (
          <div className="mention-dropdown">
            {mentionOptions.map((file) => (
              <button
                key={`${file.type}-${file.name}`}
                className="mention-option"
                onClick={() => selectMention(file)}
              >
                {file.type === 'wiki' ? file.name.replace(/\.md$/, '') : file.name}
              </button>
            ))}
          </div>
        )}
        <input
          id="prompt"
          ref={inputRef}
          type="text"
          placeholder="Frag Claude... (@ für Vault-Dateien)"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {busy ? (
          <button id="stop" className="danger-btn" onClick={onStop}>Stopp</button>
        ) : (
          <button id="send" onClick={handleSend}>Senden</button>
        )}
      </div>
    </div>
  );
}
