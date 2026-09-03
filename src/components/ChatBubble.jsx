import ReactMarkdown from 'react-markdown';
import { useToast } from './ToastContext.jsx';

const labels = { user: 'Du', assistant: 'Claude', error: 'Fehler' };

export default function ChatBubble({ role, text }) {
  const showToast = useToast();

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      showToast('In Zwischenablage kopiert.', 'success');
    } catch {
      showToast('Kopieren fehlgeschlagen.', 'error');
    }
  }

  return (
    <div className={`bubble-row ${role === 'user' ? 'user' : 'assistant'}`}>
      <div className={`bubble ${role}`}>
        <div className="bubble-label-row">
          <div className="bubble-label">{labels[role] || role}</div>
          <button className="bubble-copy-btn" onClick={copyText} title="Kopieren">⧉</button>
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
