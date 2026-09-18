import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSecurityProtection } from './utils/security';

// Initialize code protection and disable F12 / inspect in published environment
initializeSecurityProtection({
  enableDevToolsBlock: true,
  enableContextMenuBlock: true,
  enableSourceViewBlock: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
