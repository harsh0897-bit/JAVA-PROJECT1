import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { installStandaloneDemoFallback } from './fallback/installStandaloneDemoFallback';

// Section F1: Set scrollRestoration = 'manual' once at app start
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

installStandaloneDemoFallback();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
