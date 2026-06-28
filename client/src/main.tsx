import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import App from './App';

// Prevent theme flash before React hydrates
const themeScript = document.createElement('script');
themeScript.textContent = `(function(){try{var t=localStorage.getItem('ra_theme');document.documentElement.setAttribute('data-theme',t==='day'?'day':'night')}catch(e){}})();`;
document.head.prepend(themeScript);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
