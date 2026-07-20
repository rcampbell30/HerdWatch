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

function ensureCreatorCredit() {
  const footerInner = document.querySelector('.footer-inner');
  const footerBrandBlock = footerInner?.firstElementChild;

  if (footerBrandBlock && !footerBrandBlock.querySelector('[data-creator-credit]')) {
    const credit = document.createElement('div');
    credit.className = 'footer-copy';
    credit.dataset.creatorCredit = 'true';
    credit.textContent = 'Created and maintained by Rory.';
    footerBrandBlock.appendChild(credit);
  }

  if (window.location.pathname.startsWith('/methodology')) {
    const methodologyCard = document.querySelector('.prose-card');

    if (methodologyCard && !methodologyCard.querySelector('[data-creator-note]')) {
      const heading = document.createElement('h2');
      heading.dataset.creatorNote = 'true';
      heading.textContent = 'Project creator';

      const paragraph = document.createElement('p');
      paragraph.textContent = 'Immunity Map was created and is maintained by Rory as an independent public-interest project.';

      methodologyCard.append(heading, paragraph);
    }
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

window.setTimeout(ensureWakefieldLinks, 0);
window.setTimeout(ensureWakefieldLinks, 250);
window.setTimeout(ensureCreatorCredit, 0);
window.setTimeout(ensureCreatorCredit, 250);
