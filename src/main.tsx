import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './nav-fix.css';

function ensureWakefieldLinks() {
  const containers = document.querySelectorAll('.nav-links, .footer-links');

  containers.forEach((container) => {
    if (container.querySelector('a[href="/wakefield/"]')) return;

    const link = document.createElement('a');
    link.href = '/wakefield/';
    link.textContent = 'Wakefield';
    link.className = container.classList.contains('footer-links') ? 'footer-link' : 'nav-link';

    const mythLink = container.querySelector('a[href="/myths/"]');
    if (mythLink?.nextSibling) {
      container.insertBefore(link, mythLink.nextSibling);
    } else {
      container.appendChild(link);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

window.setTimeout(ensureWakefieldLinks, 0);
window.setTimeout(ensureWakefieldLinks, 250);
