import ReactMarkdown from 'react-markdown';
import { useToast } from './ToastContext.jsx';
import { useT } from '../i18n.jsx';

export default function ChatBubble({ role, text }) {
  const showToast = useToast();
  const t = useT();
  const labels = { user: t('chat.role.user'), assistant: t('chat.role.assistant'), error: t('chat.role.error') };

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('chat.copySuccess'), 'success');
    } catch {
      showToast(t('chat.copyError'), 'error');
    }
  }

  return (
    <div className={`bubble-row ${role === 'user' ? 'user' : 'assistant'}`}>
      <div className={`bubble ${role}`}>
        <div className="bubble-label-row">
          <div className="bubble-label">{labels[role] || role}</div>
          <button className="bubble-copy-btn" onClick={copyText} title={t('chat.copy')}>⧉</button>
        </div>
        {role === 'user' ? (
          <div className="bubble-text">{text}</div>
        ) : (
          <div className="bubble-text bubble-markdown">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
