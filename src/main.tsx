import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { LanguageProvider } from './context/LanguageContext';
import { OfflineIndicator } from './components/OfflineIndicator';
import { bootstrapAppearancePreferences } from './utils/appearancePreferences';
import './index.css';

bootstrapAppearancePreferences();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
        <OfflineIndicator />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);
