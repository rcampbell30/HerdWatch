(() => {
  const WAKEFIELD_HREF = '/wakefield/';
  const WAKEFIELD_LABEL = 'Wakefield';
  let localCoverageCardLoading = false;

  function isWakefieldActive() {
    return window.location.pathname.startsWith('/wakefield');
  }

  function makeNavLink() {
    const link = document.createElement('a');
    link.className = `nav-link${isWakefieldActive() ? ' active' : ''}`;
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

  function getTownSlug() {
    const match = window.location.pathname.match(/^\/town\/([^/]+)/i);
    return match ? decodeURIComponent(match[1]).toUpperCase() : null;
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Unknown';
    return Number.isInteger(number) ? `${number}%` : `${number.toFixed(1)}%`;
  }

  function riskLabel(status) {
    if (status === 'AT_RISK') return 'at risk';
    if (status === 'VULNERABLE') return 'vulnerable';
    if (status === 'PROTECTED') return 'protected';
    return 'tracked';
  }

  function makeLocalCoverageCard(area) {
    const unvaccinated = Math.max(0, Number(area.totalEligible) - Number(area.totalVaccinated));
    const gap = Math.max(0, 95 - Number(area.coverage));
    const section = document.createElement('section');
    section.className = 'card local-coverage-card';
    section.setAttribute('aria-label', `${area.postcodeDistrict} local MMR coverage summary`);
    section.innerHTML = `
      <p class="eyebrow">Local coverage summary</p>
      <h2 class="card-title">MMR coverage in ${escapeHtml(area.postcodeDistrict)}</h2>
      <p class="body-copy">
        ${escapeHtml(area.postcodeDistrict)} is recorded in ${escapeHtml(area.region)} with <strong>${formatPercent(area.coverage)} MMR1 coverage at 24 months</strong> across ${Number(area.practiceCount).toLocaleString()} represented practices. HerdWatch currently marks this postcode district as <strong>${riskLabel(area.status)}</strong> against the 95% herd-immunity target.
      </p>
      <p class="body-copy">
        The local gap to 95% is <strong>${gap.toFixed(1)} percentage points</strong>. In the generated COVER area data, ${Number(area.totalEligible).toLocaleString()} children are counted as eligible, ${Number(area.totalVaccinated).toLocaleString()} are counted as vaccinated, and approximately ${unvaccinated.toLocaleString()} are not counted as vaccinated. These are postcode-district indicators, not household-level or individual records.
      </p>
      <p class="body-copy">
        HerdWatch is an explanatory public-health data interface, not medical advice or an official NHS/UKHSA service. For personal vaccination guidance, use NHS advice or contact a GP practice.
      </p>
    `;
    return section;
  }

  async function addLocalCoverageCard() {
    const slug = getTownSlug();
    if (!slug || localCoverageCardLoading || document.querySelector('.local-coverage-card')) return;

    const mainCol = document.querySelector('.main-col');
    const metricGrid = document.querySelector('.main-col .metric-grid');
    if (!mainCol || !metricGrid) return;

    localCoverageCardLoading = true;

    try {
      const response = await fetch('/data/areas.json', { cache: 'force-cache' });
      if (!response.ok) return;
      const areas = await response.json();
      const area = areas.find((item) => String(item.postcodeDistrict).toUpperCase() === slug);
      if (!area || document.querySelector('.local-coverage-card')) return;

      const card = makeLocalCoverageCard(area);
      metricGrid.insertAdjacentElement('afterend', card);
    } catch {
      // Non-critical enhancement. The React page and static noscript summary still render without this card.
    } finally {
      localCoverageCardLoading = false;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function patchLinks() {
    addWakefieldNavLink();
    addWakefieldFooterLink();
    addLocalCoverageCard();
  }

  patchLinks();

  const observer = new MutationObserver(patchLinks);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setTimeout(() => observer.disconnect(), 10000);
})();