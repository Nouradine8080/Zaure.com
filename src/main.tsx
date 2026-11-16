import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import { LanguageProvider } from './context/LanguageContext';
import { OfflineIndicator } from './components/OfflineIndicator';
import './index.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
      <OfflineIndicator />
    </LanguageProvider>
  </StrictMode>,
);

