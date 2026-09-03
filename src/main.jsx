import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/ToastContext.jsx';
import { LanguageProvider } from './i18n.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ToastProvider>
);
