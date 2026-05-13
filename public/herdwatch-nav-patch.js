(() => {
  const WAKEFIELD_HREF = '/wakefield/';
  const WAKEFIELD_LABEL = 'Wakefield';

  function isActive() {
    return window.location.pathname.startsWith('/wakefield');
  }

  function makeNavLink() {
    const link = document.createElement('a');
    link.className = `nav-link${isActive() ? ' active' : ''}`;
    link.href = WAKEFIELD_HREF;
    link.textContent = WAKEFIELD_LABEL;
    return link;
  }

  function makeFooterLink() {
    const link = document.createElement('a');
    link.className = 'footer-link';
    link.href = WAKEFIELD_HREF;
    link.textContent = WAKEFIELD_LABEL;
    return link;
  }

  function addWakefieldNavLink() {
    const nav = document.querySelector('.nav-links');
    if (!nav || nav.querySelector(`a[href="${WAKEFIELD_HREF}"]`)) return;

    const mythLink = nav.querySelector('a[href="/myths/"]');
    const wakefieldLink = makeNavLink();

    if (mythLink && mythLink.nextSibling) {
      nav.insertBefore(wakefieldLink, mythLink.nextSibling);
    } else {
      nav.appendChild(wakefieldLink);
    }
  }

  function addWakefieldFooterLink() {
    const footer = document.querySelector('.footer-links');
    if (!footer || footer.querySelector(`a[href="${WAKEFIELD_HREF}"]`)) return;

    const mythLink = footer.querySelector('a[href="/myths/"]');
    const wakefieldLink = makeFooterLink();

    if (mythLink && mythLink.nextSibling) {
      footer.insertBefore(wakefieldLink, mythLink.nextSibling);
    } else {
      footer.appendChild(wakefieldLink);
    }
  }

  function patchLinks() {
    addWakefieldNavLink();
    addWakefieldFooterLink();
  }

  patchLinks();

  const observer = new MutationObserver(patchLinks);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 10000);
})();
