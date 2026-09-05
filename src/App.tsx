import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { areas, deployedNationalStats } from './data/areas';
import { buildAreaTrend, nationalTrend } from './data/trends';
import { CoverageMap } from './CoverageMap';
import { searchAreas } from './search';
import places from './data/generated/search-places.json';
import metadata from './data/generated/metadata.json';
import type { HerdArea, RiskStatus, TrendPoint } from './types';

const brandName = 'Immunity Map';
const brandTagline = 'Recorded MMR coverage grouped by GP-practice postcode district across England.';
const target = deployedNationalStats.herdImmunityTarget;
const latestTrendPoint = nationalTrend[nationalTrend.length - 1];
const LINE_MMR1 = '#2563eb';
const LINE_MMR2 = '#0f766e';
const LINE_AREA = '#111827';
const LINE_TARGET = '#dc2626';

const liveAreaStats = {
  totalAreasTracked: areas.length,
  atRiskAreas: areas.filter((area) => area.status === 'AT_RISK').length,
  vulnerableAreas: areas.filter((area) => area.status === 'VULNERABLE').length,
  protectedAreas: areas.filter((area) => area.status === 'PROTECTED').length,
  unvaccinatedChildren: areas.reduce((sum, area) => sum + Math.max(0, area.totalEligible - area.totalVaccinated), 0),
  aggregateCoverage: (() => {
    const eligible = areas.reduce((sum, area) => sum + area.totalEligible, 0);
    const vaccinated = areas.reduce((sum, area) => sum + area.totalVaccinated, 0);
    return eligible > 0 ? (vaccinated / eligible) * 100 : 0;
  })(),
  englandAverage: latestTrendPoint?.englandMmr1 ?? deployedNationalStats.englandAverage,
  englandMmr2: latestTrendPoint?.englandMmr2,
  latestTrendYear: latestTrendPoint?.year ?? '2024-25'
};

const riskCopy: Record<RiskStatus, { label: string; description: string; className: string }> = {
  AT_RISK: { label: 'WELL BELOW TARGET', description: 'Recorded coverage is below 90%.', className: 'risk' },
  VULNERABLE: { label: 'BELOW TARGET', description: 'Recorded coverage is from 90% to below 95%.', className: 'vulnerable' },
  PROTECTED: { label: 'MEETS TARGET', description: 'Recorded coverage is at or above 95%.', className: 'protected' }
};

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function unvaccinated(area: HerdArea): number {
  return Math.max(0, area.totalEligible - area.totalVaccinated);
}

function neededForTarget(area: HerdArea): number {
  return Math.max(0, Math.ceil((target / 100) * area.totalEligible - area.totalVaccinated));
}

function getAreaFromPath(pathname: string): HerdArea | undefined {
  const match = pathname.match(/^\/town\/([^/]+)/i);
  if (!match) return undefined;
  const slug = decodeURIComponent(match[1]).toUpperCase();
  return areas.find((area) => area.postcodeDistrict.toUpperCase() === slug);
}

function getPageFromPath(pathname: string): 'home' | 'towns' | 'town' | 'map' | 'myths' | 'wakefield' | 'methodology' | 'not-found' {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/town/')) return 'town';
  if (pathname.startsWith('/towns')) return 'towns';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname.startsWith('/myths')) return 'myths';
  if (pathname.startsWith('/wakefield')) return 'wakefield';
  if (pathname.startsWith('/methodology')) return 'methodology';
  return 'not-found';
}

function BrandText() {
  return <>Immunity<span>Map</span></>;
}

function Nav() {
  const pathname = window.location.pathname;
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="nav" aria-label="Primary navigation">
      <a className="nav-brand" href="/"><BrandText /></a>
      <div className="nav-links">
        <a className={`nav-link ${isActive('/') ? 'active' : ''}`} href="/">Home</a>
        <a className={`nav-link ${isActive('/map') ? 'active' : ''}`} href="/map/">Explorer</a>
        <a className={`nav-link ${isActive('/towns') ? 'active' : ''}`} href="/towns/">All Areas</a>
        <a className={`nav-link ${isActive('/methodology') ? 'active' : ''}`} href="/methodology/">Methodology</a>
        <a className={`nav-link ${isActive('/myths') ? 'active' : ''}`} href="/myths/">MMR evidence</a>
        <a className={`nav-link ${isActive('/wakefield') ? 'active' : ''}`} href="/wakefield/">Wakefield</a>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-main">
          <div>
            <a className="footer-brand" href="/"><BrandText /></a>
            <p className="footer-summary">Independent public-interest MMR coverage project.</p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="/map/" className="footer-link">Explorer</a>
            <a href="/towns/" className="footer-link">All areas</a>
            <a href="/myths/" className="footer-link">MMR evidence</a>
            <a href="/wakefield/" className="footer-link">Wakefield record</a>
            <a href="/methodology/" className="footer-link">Methodology</a>
          </nav>
        </div>
        <div className="footer-meta">
          <p className="footer-copy">
            Created and maintained by Rory Campbell. Contains UK Health Security Agency data licensed under the{' '}
            <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer">Open Government Licence v3.0</a>.{' '}
            Not medical advice.
          </p>
          <nav className="footer-legal" aria-label="Legal">
            <a href="/privacy.html" className="footer-link">Privacy</a>
            <a href="/terms.html" className="footer-link">Terms</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function DataNotice() {
  const importedAt = metadata.lastSuccessfulImportAt;
  return (
    <div className="notice-card" role="note">
      <div className="data-dates">
        <span><strong>GP data period:</strong> {metadata.reportingPeriod ?? 'Not recorded — see methodology'}</span>
        <span><strong>Last successful source import:</strong> {importedAt ? new Date(importedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Date not recorded for this dataset'}</span>
        <a href="/methodology/">Sources and limitations</a>
      </div>
      <p><strong>What these figures mean:</strong> Records are grouped by the GP practice’s postcode, not each child’s home. They describe recorded vaccination coverage, not measured immunity or an outbreak forecast. Patients may live outside the district. The quarterly figures are provisional.</p>
    </div>
  );
}

function SearchHelp() {
  return <p className="search-help">Use a full postcode, district or place name. Results describe practices in that district, which may differ from your own GP. Place names come from NHS practice addresses.</p>;
}

function CountNote() {
  return <p className="count-note"><strong>Approximate counts:</strong> vaccinated totals may be reconstructed from rounded source percentages. Counts not recorded as vaccinated and additional records needed for 95% inherit that uncertainty. Missing vaccination records do not prove a child is unvaccinated.</p>;
}

function CoverageChartGraphic({ data, selectedAreaName }: { data: TrendPoint[]; selectedAreaName?: string }) {
  const width = 760;
  const height = 340;
  const margin = { top: 52, right: 42, bottom: 54, left: 54 };
  const values = data.flatMap((point) => [point.englandMmr1, point.englandMmr2, point.selectedArea]).filter((value): value is number => typeof value === 'number');
  const minimum = Math.min(...values);
  const yMin = selectedAreaName ? Math.max(0, Math.floor((minimum - 3) / 10) * 10) : 80;
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xAt = (index: number) => data.length === 1 ? margin.left + plotWidth / 2 : margin.left + (index / (data.length - 1)) * plotWidth;
  const yAt = (value: number) => margin.top + ((100 - value) / (100 - yMin)) * plotHeight;
  const step = yMin < 80 ? 10 : 5;
  const ticks: number[] = [];
  for (let value = Math.ceil(yMin / step) * step; value <= 100; value += step) ticks.push(value);
  if (!ticks.includes(95)) ticks.push(95);
  ticks.sort((a, b) => a - b);

  const pointsFor = (key: 'englandMmr1' | 'englandMmr2' | 'selectedArea') => data
    .map((point, index) => typeof point[key] === 'number' ? `${xAt(index)},${yAt(point[key])}` : null)
    .filter((value): value is string => value !== null)
    .join(' ');

  const series = [
    { key: 'englandMmr1' as const, label: 'England MMR1', colour: LINE_MMR1 },
    { key: 'englandMmr2' as const, label: 'England MMR2', colour: LINE_MMR2 },
    ...(selectedAreaName ? [{ key: 'selectedArea' as const, label: selectedAreaName, colour: LINE_AREA }] : [])
  ];

  return (
    <svg className="coverage-chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <g className="chart-legend-svg">
        {series.map((item, index) => <g key={item.key} transform={`translate(${margin.left + index * 190} 22)`}><line x1="0" y1="0" x2="24" y2="0" stroke={item.colour} strokeWidth="4" /><text x="32" y="5">{item.label}</text></g>)}
      </g>
      {ticks.map((tick) => <g key={tick}><line x1={margin.left} x2={width - margin.right} y1={yAt(tick)} y2={yAt(tick)} className="chart-grid-line" /><text x={margin.left - 10} y={yAt(tick) + 4} textAnchor="end" className="chart-axis-label">{tick}%</text></g>)}
      <line x1={margin.left} x2={width - margin.right} y1={yAt(95)} y2={yAt(95)} stroke={LINE_TARGET} strokeWidth="2" strokeDasharray="6 5" />
      <text x={width - margin.right} y={yAt(95) - 7} textAnchor="end" className="chart-target-label">95% target</text>
      {data.map((point, index) => <text key={point.year} x={xAt(index)} y={height - 18} textAnchor="middle" className="chart-axis-label">{point.year}</text>)}
      {series.map((item) => {
        const points = pointsFor(item.key);
        return <g key={item.key}>{points.split(' ').length > 1 ? <polyline points={points} fill="none" stroke={item.colour} strokeWidth="4" strokeLinejoin="round" /> : null}{data.map((point, index) => { const value = point[item.key]; return typeof value === 'number' ? <circle key={`${item.key}-${point.year}`} cx={xAt(index)} cy={yAt(value)} r="5" fill={item.colour}><title>{item.label}: {formatPercent(value)} in {point.year}</title></circle> : null; })}</g>;
      })}
    </svg>
  );
}

function TrendChart({ data, selectedAreaName }: { data: TrendPoint[]; selectedAreaName?: string }) {
  if (!data.length) {
    return (
      <section className="card trend-card">
        <div className="card-heading-row">
          <div><p className="eyebrow">Coverage data</p><h2 className="card-title">Vaccination coverage chart</h2></div>
          <span className="data-badge">Data unavailable</span>
        </div>
        <div className="trend-insight"><strong>Insight:</strong> no trend rows are currently available.</div>
      </section>
    );
  }

  const latest = data[data.length - 1];
  const latestMmr1 = latest.englandMmr1;
  const gap = Number((target - latestMmr1).toFixed(1));
  const hasSeries = data.length > 1;
  return (
    <section className="card trend-card">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">{hasSeries ? 'Official COVER comparison' : 'Latest COVER point'}</p>
          <h2 className="card-title">Vaccination coverage {hasSeries ? 'trend' : 'snapshot'}</h2>
        </div>
        <span className="data-badge">Processed UKHSA COVER data</span>
      </div>
      <div className="chart-wrap" role="img" aria-label={`MMR vaccination coverage chart. Latest England MMR1 is ${formatPercent(latest.englandMmr1)} and MMR2 is ${formatPercent(latest.englandMmr2)} for ${latest.year}.`}>
        <CoverageChartGraphic data={data} selectedAreaName={selectedAreaName} />
      </div>
      <table className="sr-only">
        <caption>MMR vaccination coverage values shown in the chart</caption>
        <thead><tr><th>Period</th><th>England MMR1</th><th>England MMR2</th>{selectedAreaName ? <th>{selectedAreaName}</th> : null}</tr></thead>
        <tbody>{data.map((point) => <tr key={point.year}><td>{point.year}</td><td>{formatPercent(point.englandMmr1)}</td><td>{formatPercent(point.englandMmr2)}</td>{selectedAreaName ? <td>{typeof point.selectedArea === 'number' ? formatPercent(point.selectedArea) : 'Not available'}</td> : null}</tr>)}</tbody>
      </table>
      <div className="trend-insight">
        {hasSeries ? (
          <><strong>Latest point:</strong> England MMR1 is {formatPercent(latest.englandMmr1)} for {latest.year}, {gap.toFixed(1)} percentage points below the 95% target.{selectedAreaName ? ' The local figure is a latest-period snapshot; a local time series is not available.' : ''}</>
        ) : (
          <><strong>Latest point:</strong> England MMR1 is {formatPercent(latest.englandMmr1)} and England MMR2 is {formatPercent(latest.englandMmr2)} for {latest.year}.</>
        )}
      </div>
      <p className="chart-source"><a href="https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-2025-to-2026-quarterly-data/quarterly-vaccination-coverage-statistics-for-children-aged-up-to-5-years-in-the-uk-cover-programme-january-to-march-2026" target="_blank" rel="noreferrer">UKHSA COVER source and provisional-data notes</a></p>
    </section>
  );
}

function Hero() {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const results = useMemo(() => query.trim() ? searchAreas(areas, query, places) : [], [query]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (results.length === 1) {
      window.location.assign(`/town/${results[0].postcodeDistrict.toLowerCase()}/`);
    } else if (results.length > 1) {
      window.location.assign(`/towns/?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="hero-tag">{deployedNationalStats.sourceLabel}</div>
        <h1 className="hero-title"><span>MMR vaccination</span>{' '}<br /><span>coverage <em>tracker</em></span></h1>
        <p className="hero-sub">{brandTagline}</p>
        <form className="search-wrap" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="home-area-search">Search by postcode, place name or NHS grouping</label>
          <div className="search-row">
            <input id="home-area-search" className="search-input" placeholder="Try Blackpool, FY1 or a full postcode" value={query} onChange={(event) => setQuery(event.target.value)} aria-describedby="home-search-help" />
            <button className="search-button" type="submit">Go</button>
          </div>
          {results.length > 0 ? (
            <div className="search-dropdown" id="home-search-results" aria-label="Matching practice postcode districts">
              {results.slice(0, 8).map((area) => (
                <a key={area.postcodeDistrict} href={`/town/${area.postcodeDistrict.toLowerCase()}/`} className="search-item">
                  <span>{area.postcodeDistrict} · {(places as Record<string, string[]>)[area.postcodeDistrict]?.join(", ") || area.region}</span>
                  <strong>{formatPercent(area.coverage)}</strong>
                </a>
              ))}
              {results.length > 8 ? <a className="search-item" href={`/towns/?q=${encodeURIComponent(query.trim())}`}>View all {results.length} matching districts</a> : null}
            </div>
          ) : query.trim() ? <p className="search-empty" role="status">No matching practice district. Try a place name or another postcode; some districts have no represented practices.</p> : null}
        </form>
        <div id="home-search-help"><SearchHelp /></div>
      </div>
    </section>
  );
}

function StatGrid() {
  return (
    <div className="stats-grid">
      <div className="stat-card risk"><div className="stat-num risk">{liveAreaStats.atRiskAreas.toLocaleString()}</div><div className="stat-label">WELL BELOW TARGET</div><div className="stat-desc">Practice postcode districts below 90%</div></div>
      <div className="stat-card vulnerable"><div className="stat-num vulnerable">{liveAreaStats.vulnerableAreas.toLocaleString()}</div><div className="stat-label">BELOW TARGET</div><div className="stat-desc">Practice postcode districts from 90% to below 95%</div></div>
      <div className="stat-card protected"><div className="stat-num protected">{liveAreaStats.protectedAreas.toLocaleString()}</div><div className="stat-label">MEETS TARGET</div><div className="stat-desc">Practice postcode districts at or above 95%</div></div>
      <div className="stat-card total"><div className="stat-num">{liveAreaStats.totalAreasTracked.toLocaleString()}</div><div className="stat-label">TOTAL AREAS</div><div className="stat-desc">Imported postcode districts</div></div>
    </div>
  );
}

function NationalPicture() {
  return (
    <>
      <SectionHeader title="National Picture" />
      <div className="context-card">
        <div className="context-item"><div className="context-val risk-text">{formatPercent(liveAreaStats.englandAverage)}</div><div className="context-item-label">England MMR1</div><div className="context-item-sub">Official COVER point for {liveAreaStats.latestTrendYear}, below the 95% target.</div></div>
        <div className="context-item bordered"><div className="context-val protected-text">{target}%</div><div className="context-item-label">Coverage Target</div><div className="context-item-sub">The working threshold {brandName} uses to flag local vulnerability.</div></div>
        <div className="context-item"><div className="context-val vulnerable-text">{formatPercent(liveAreaStats.aggregateCoverage)}</div><div className="context-item-label">Coverage across included records</div><div className="context-item-sub">Eligible-child weighted coverage across imported GP-practice rows.</div></div>
      </div>
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <div className="section-header"><h2 className="section-title">{title}</h2><div className="section-line" /></div>;
}

function AreaCard({ area }: { area: HerdArea }) {
  const meta = riskCopy[area.status];
  return (
    <a className="town-card" href={`/town/${area.postcodeDistrict.toLowerCase()}/`}>
      <div><div className="town-district">{area.postcodeDistrict}</div><div className="town-meta">{area.practiceCount} {area.practiceCount === 1 ? 'practice' : 'practices'} · {area.region}</div>{area.totalEligible < 30 ? <span className="small-sample">Small sample: {area.totalEligible} eligible records</span> : null}</div>
      <div className="town-card-right"><div className={`town-cov ${meta.className}-text`}>{formatPercent(area.coverage)}</div><div className={`town-badge ${meta.className}`}>{meta.label}</div></div>
    </a>
  );
}

function HomePage() {
  const lowestRecordedCoverage = [...areas].filter((area) => area.totalEligible >= 30).sort((a, b) => a.coverage - b.coverage).slice(0, 18);
  return (
    <>
      <Hero />
      <div className="counter-bar"><div className="counter-inner"><div className="counter-num">≈{liveAreaStats.unvaccinatedChildren.toLocaleString()}</div><div className="counter-label">estimated records not counted as vaccinated<br />across included GP-practice groups</div></div></div>
      <main className="main-content">
        <DataNotice />
        <CountNote />
        <StatGrid />
        <NationalPicture />
        <TrendChart data={nationalTrend} />
        <SectionHeader title="Lowest recorded coverage" />
        <p className="section-note">Practice postcode districts with at least 30 eligible records, sorted by recorded MMR1 coverage. Smaller samples remain available in the Explorer.</p>
        <div className="worst-grid">{lowestRecordedCoverage.map((area) => <AreaCard key={area.postcodeDistrict} area={area} />)}</div>
        <div className="cta-row"><a className="btn btn-red" href="/map/">Open Explorer →</a><a className="btn btn-dark" href="/towns/">All Areas →</a><a className="btn btn-outline" href="/methodology/">Methodology</a></div>
      </main>
    </>
  );
}

function TownsPage() {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [visibleCount, setVisibleCount] = useState(80);
  const filtered = useMemo(() => searchAreas(areas, query, places).sort((a, b) => a.coverage - b.coverage), [query]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <main className="main-content page-shell">
      <PageTitle eyebrow="All areas" title="Vaccination coverage by practice postcode district" description={`Search ${liveAreaStats.totalAreasTracked.toLocaleString()} practice-location groups derived from UKHSA COVER GP-level data.`} />
      <DataNotice />
      <label className="field-label" htmlFor="all-areas-search">Search postcode, place name or NHS grouping</label>
      <input id="all-areas-search" className="search-input light" placeholder="Try Blackpool, FY1 or a full postcode" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(80); }} />
      <SearchHelp />
      <p className="result-status" role="status" aria-live="polite">{filtered.length.toLocaleString()} matching {filtered.length === 1 ? 'area' : 'areas'}.</p>
      <div className="table-card">
        <table>
          <caption className="sr-only">Coverage grouped by GP-practice postcode district</caption>
          <thead><tr><th>Area</th><th>Region</th><th>Practices</th><th>Coverage</th><th>Status</th><th>Gap to 95%</th></tr></thead>
          <tbody>
            {visible.map((area) => (
              <tr key={area.postcodeDistrict}>
                <td><a href={`/town/${area.postcodeDistrict.toLowerCase()}/`}>{area.postcodeDistrict}</a><span className="place-names">{(places as Record<string, string[]>)[area.postcodeDistrict]?.join(", ")}</span></td>
                <td>{area.region}</td><td>{area.practiceCount}</td><td>{formatPercent(area.coverage)}{area.totalEligible < 30 ? <span className="small-sample table-sample">Small sample</span> : null}</td>
                <td><span className={`town-badge ${riskCopy[area.status].className}`}>{riskCopy[area.status].label}</span></td>
                <td>{Math.max(0, target - area.coverage).toFixed(1)} pts</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleCount < filtered.length ? <button className="btn btn-outline" type="button" onClick={() => setVisibleCount((count) => count + 80)}>View more areas ({visible.length.toLocaleString()} of {filtered.length.toLocaleString()})</button> : null}
    </main>
  );
}

function TownPage({ area }: { area?: HerdArea }) {
  if (!area) {
    return <main className="main-content page-shell centered"><h1>Area not found</h1><p>This postcode district is not currently present in the generated COVER area dataset.</p><a className="btn btn-red" href="/towns/">Browse areas</a></main>;
  }

  const meta = riskCopy[area.status];
  const areaTrend = buildAreaTrend(area.coverage);
  const nearby = areas.filter((item) => item.region === area.region && item.postcodeDistrict !== area.postcodeDistrict).sort((a, b) => Math.abs(a.coverage - area.coverage) - Math.abs(b.coverage - area.coverage)).slice(0, 5);

  return (
    <>
      <section className="hero-band"><div className="hero-inner"><div className="breadcrumb"><a className="bc-link" href="/">Home</a><span className="bc-sep">/</span><a className="bc-link" href="/towns/">Areas</a><span className="bc-sep">/</span><span className="bc-cur">{area.postcodeDistrict}</span></div><h1 className="hero-title"><span className="postcode">{area.postcodeDistrict}</span> GP-practice coverage</h1></div></section>
      <main className="content-layout">
        <section className="main-col">
          <DataNotice />
          <div className={`status-banner ${meta.className}`}><div><div className="status-threat">Coverage band</div><div className="status-label">{meta.label}</div><div className="status-desc">{meta.description}</div></div><div className="status-right"><div className="big-coverage">{formatPercent(area.coverage)}</div><div className="cov-label">Recorded MMR1 coverage at 24 months</div></div></div>
          {area.totalEligible < 30 ? <div className="sample-warning" role="note"><strong>Small sample:</strong> this percentage is based on {area.totalEligible.toLocaleString()} eligible records and may change sharply with only a few records.</div> : null}
          <div className="metric-grid card"><Metric label="Eligible records" value={area.totalEligible.toLocaleString()} /><Metric label="Vaccinated (approx.)" value={`≈${area.totalVaccinated.toLocaleString()}`} /><Metric label="Not recorded vaccinated (approx.)" value={`≈${unvaccinated(area).toLocaleString()}`} /><Metric label="Additional records for 95% (approx.)" value={`≈${neededForTarget(area).toLocaleString()}`} /></div>
          <CountNote />
          <TrendChart data={areaTrend} selectedAreaName={area.postcodeDistrict} />
          <section className="card"><h2 className="card-title">How to read this</h2><p className="body-copy">The percentage combines COVER records for GP practices whose practice postcode begins {area.postcodeDistrict}. It does not estimate vaccination among everyone living in {area.postcodeDistrict}, and it does not indicate that an outbreak is occurring. Coverage below 95% means the recorded group is below the programme target.</p></section>
        </section>
        <aside className="side-col">
          <div className="side-card"><h2 className="side-title">Record summary</h2><div className="fact-item"><span aria-hidden="true">📍</span><p>The practice-postcode grouping is assigned to {area.region}.</p></div><div className="fact-item"><span aria-hidden="true">🏥</span><p>{area.practiceCount} {area.practiceCount === 1 ? 'practice is' : 'practices are'} represented in the imported GP-level COVER records.</p></div><div className="fact-item"><span aria-hidden="true">🎯</span><p>Gap to target: {Math.max(0, target - area.coverage).toFixed(1)} percentage points.</p></div></div>
          <div className="side-card"><h2 className="side-title">Similar coverage in the same NHS grouping</h2>{nearby.map((item) => <AreaCard key={item.postcodeDistrict} area={item} />)}</div>
          <div className="gp-cta"><h3>Need vaccination guidance?</h3><p>Use official NHS advice or contact your GP practice.</p><a className="gp-btn" href="https://www.nhs.uk/vaccinations/mmr-vaccine/" target="_blank" rel="noreferrer">NHS MMR advice</a></div>
        </aside>
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><div className="metric-val">{value}</div><div className="metric-label">{label}</div></div>;
}

function MapPage() {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [status, setStatus] = useState<RiskStatus | 'ALL'>('ALL');
  const [region, setRegion] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(80);
  const regionOptions = useMemo(() => [...new Set(areas.map((area) => area.region))].sort(), []);
  const filtered = useMemo(() => {
    return searchAreas(areas, query, places)
      .filter((area) => status === 'ALL' || area.status === status)
      .filter((area) => region === 'ALL' || area.region === region)
      .sort((a, b) => a.coverage - b.coverage || a.postcodeDistrict.localeCompare(b.postcodeDistrict));
  }, [query, region, status]);
  const visibleRows = filtered.slice(0, visibleCount);
  const filteredEligible = filtered.reduce((sum, area) => sum + area.totalEligible, 0);
  const filteredVaccinated = filtered.reduce((sum, area) => sum + area.totalVaccinated, 0);
  const filteredCoverage = filteredEligible > 0 ? (filteredVaccinated / filteredEligible) * 100 : null;
  const hasFilters = query.trim().length > 0 || status !== 'ALL' || region !== 'ALL';

  const resetFilters = () => {
    setQuery('');
    setStatus('ALL');
    setRegion('ALL');
    setVisibleCount(80);
  };

  return (
    <main className="main-content page-shell">
      <PageTitle eyebrow="Geographic explorer" title="Recorded MMR coverage across England" description={`Explore ${areas.length.toLocaleString()} postcode-district groups based on where represented GP practices are located.`} />
      <DataNotice />

      <section className="map-controls" aria-labelledby="map-filter-title">
        <div className="map-controls-heading">
          <div><h2 id="map-filter-title">Filter the map</h2><p>Find a postcode or place, then narrow by recorded coverage band.</p></div>
          {hasFilters ? <button className="map-reset" type="button" onClick={resetFilters}>Clear filters</button> : null}
        </div>
        <div className="map-filter-grid">
          <label><span>Postcode, place name or NHS grouping</span><input className="search-input light" type="search" placeholder="Try Blackpool, FY1 or a full postcode" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(80); }} /></label>
          <label><span>Coverage band</span><select value={status} onChange={(event) => { setStatus(event.target.value as RiskStatus | 'ALL'); setVisibleCount(80); }}><option value="ALL">All coverage bands</option><option value="AT_RISK">Well below target (&lt;90%)</option><option value="VULNERABLE">Below target (90–&lt;95%)</option><option value="PROTECTED">Meets target (95%+)</option></select></label>
          <label><span>NHS grouping</span><select value={region} onChange={(event) => { setRegion(event.target.value); setVisibleCount(80); }}><option value="ALL">All NHS groupings</option>{regionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
        </div>
      </section>

      <SearchHelp />
      <div className="map-result-bar" role="status" aria-live="polite">
        <strong>{filtered.length.toLocaleString()} {filtered.length === 1 ? 'district' : 'districts'}</strong>
        <span>{filteredCoverage == null ? 'No coverage value' : `${formatPercent(filteredCoverage)} eligible-record weighted coverage`}</span>
      </div>

      <section aria-labelledby="coverage-map-title">
        <div className="map-heading-row">
          <div><h2 id="coverage-map-title">Practice-location reference map</h2><p>Click or tap a point to open its coverage summary.</p></div>
          <div className="map-legend" aria-label="Map legend">
            <span><i className="legend-dot risk" />Well below target</span>
            <span><i className="legend-dot vulnerable" />Below target</span>
            <span><i className="legend-dot protected" />Meets target</span>
            <span><i className="legend-dot small" />Small sample</span>
          </div>
        </div>
        <CoverageMap allAreas={areas} visibleAreas={filtered} />
        <p className="map-caveat"><strong>Geography note:</strong> each point is a reference centroid for a GP-practice postcode district, calculated from live ONS postcode-unit centroids. It is not a patient location, an exact practice address or a postcode-district boundary. Faded outlined points have fewer than 30 eligible records.</p>
      </section>

      <section className="map-table-section" aria-labelledby="map-table-title">
        <div className="map-heading-row"><div><h2 id="map-table-title">Accessible results table</h2><p>The same filtered records are available without using the map.</p></div></div>
        <div className="table-card">
          <table>
            <caption className="sr-only">Filtered MMR coverage grouped by GP-practice postcode district</caption>
            <thead><tr><th>Area</th><th>NHS grouping</th><th>Practices</th><th>Eligible</th><th>Coverage</th><th>Status</th></tr></thead>
            <tbody>
              {visibleRows.map((area) => (
                <tr key={area.postcodeDistrict}>
                  <td><a href={`/town/${area.postcodeDistrict.toLowerCase()}/`}>{area.postcodeDistrict}</a><span className="place-names">{(places as Record<string, string[]>)[area.postcodeDistrict]?.join(", ")}</span></td>
                  <td>{area.region}</td>
                  <td>{area.practiceCount}</td>
                  <td>{area.totalEligible.toLocaleString()}</td>
                  <td>{formatPercent(area.coverage)}{area.totalEligible < 30 ? <span className="small-sample table-sample">Small sample</span> : null}</td>
                  <td><span className={`town-badge ${riskCopy[area.status].className}`}>{riskCopy[area.status].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleCount < filtered.length ? <button className="btn btn-outline" type="button" onClick={() => setVisibleCount((count) => count + 80)}>View more areas ({visibleRows.length.toLocaleString()} of {filtered.length.toLocaleString()})</button> : null}
      </section>
    </main>
  );
}

function MythsPage() {
  return (
    <main className="main-content page-shell readable">
      <PageTitle
        eyebrow="The myth"
        title="Herd immunity is not magic"
        description="It is a threshold effect: when enough people are immune, infections have fewer routes through a community."
      />

      <section className="card prose-card">
        <h2>Why the 95% line matters</h2>
        <p>
          Measles is unusually infectious. When MMR coverage drops below the herd-immunity target,
          outbreaks become easier to start and harder to contain.
        </p>
        <p>
          The 95% figure is not a moral judgement on individual families. It is a practical warning
          line for communities, schools, nurseries and health systems.
        </p>
      </section>

      <section className="card prose-card">
        <h2>The common mistake</h2>
        <p>
          The mistake is thinking herd immunity means everyone is perfectly protected. It does not.
          It means infection has fewer paths through the population, so outbreaks are less likely to
          accelerate.
        </p>
        <p>
          When coverage is patchy, even a national average can hide local vulnerability. That is why
          {brandName} focuses on postcode-district level signals instead of only headline national figures.
        </p>
      </section>

      <section className="card prose-card">
        <h2>Who low coverage puts at risk</h2>
        <p>
          Falling MMR coverage matters most for people who cannot rely on vaccination themselves:
          babies too young for MMR, people with weakened immune systems, and people whose protection
          did not fully develop after vaccination.
        </p>
        <p>
          The point of the site is not to shame families. The useful civic question is simpler:
          where are the weak spots, and how visible are they?
        </p>
      </section>

      <section className="card prose-card">
        <h2>What {brandName} is measuring</h2>
        <p>
          {brandName} uses generated NHS COVER area data aggregated into postcode districts. The figures
          are local coverage indicators, not household-level records and not individual vaccination records.
        </p>
        <p>
          A red area means coverage is below the safer threshold. It does not prove an outbreak is happening.
          It means the area may be more vulnerable if measles is introduced.
        </p>
      </section>

      <section className="card prose-card">
        <h2>Useful next step</h2>
        <p>
          If you are unsure about your own or your child's vaccination status, use official NHS guidance
          or contact your GP practice. {brandName} is a public-interest dashboard, not medical advice.
        </p>
        <p>
          <a className="btn btn-red" href="https://www.nhs.uk/vaccinations/mmr-vaccine/" target="_blank" rel="noreferrer">
            Read NHS MMR guidance
          </a>
        </p>
      </section>
    </main>
  );
}

function WakefieldPage() {
  return (
    <main className="main-content page-shell readable">
      <PageTitle
        eyebrow="Who he was · documented record"
        title="Andrew Wakefield: who he was and how he was involved"
        description="Wakefield was a doctor and gastroenterology researcher at London's Royal Free Hospital, the lead investigator and first-listed author of the 1998 Lancet paper, and the researcher who publicly urged parents to choose separate vaccines instead of MMR."
      />

      <section className="card prose-card">
        <h2>His direct role in the MMR scare</h2>
        <p>
          Wakefield was not a commentator who became attached to the story later. He led the Royal Free
          research and was the first-named author of the{' '}
          <a href="https://www.thelancet.com/journals/lancet/article/PIIS0140-6736%2897%2911096-0/abstract" target="_blank" rel="noreferrer">1998 Lancet case series</a>,
          which described 12 children but could not establish that MMR caused autism.
        </p>
        <p>
          At the paper's press launch, he recommended separate vaccines rather than MMR. A{' '}
          <a href="https://www.parliament.uk/globalassets/documents/post/postpn219.pdf" target="_blank" rel="noreferrer">Parliamentary Office of Science and Technology review</a>{' '}
          records that intervention, the ensuing media coverage and the fall in vaccination rates that followed.
          That combination of research leadership and public advocacy is why he is central to this history.
        </p>
      </section>

      <section className="card prose-card">
        <h2>What happened next</h2>
        <p>
          The paper was fully retracted in 2010, Wakefield was removed from the UK medical register,
          and a later BMJ investigation described the article as fraudulent.
        </p>
        <p>
          {brandName} documents those established facts while avoiding unsupported death totals or the
          claim that one historical episode explains every later change in coverage.
        </p>
      </section>

      <section className="card prose-card">
        <h2>What the data question becomes</h2>
        <p>
          The useful question is not whether one parent is to blame. The useful question is whether
          whole areas have slipped below safer coverage levels.
        </p>
        <p>
          That is why {brandName} tracks postcode-district coverage and flags places below the 95% target
          or below 90%, where vulnerability becomes harder to ignore.
        </p>
      </section>

      <section className="card prose-card">
        <h2>What this page is not saying</h2>
        <p>
          This page is not medical advice. It is not a substitute for a GP, NHS guidance or official
          public health advice.
        </p>
        <p>
          It is a plain-English explanation of why misinformation can have a measurable civic cost:
          fewer protected people, weaker herd immunity and more outbreak risk.
        </p>
      </section>

      <section className="card prose-card">
        <h2>Where to go next</h2>
        <p>
          Use the explorer to look at local coverage, or read NHS guidance if you need practical
          information about the MMR vaccine.
        </p>
        <p>
          <a className="btn btn-red" href="/map/">Open the coverage explorer</a>
          {' '}
          <a className="btn btn-outline" href="https://www.nhs.uk/vaccinations/mmr-vaccine/" target="_blank" rel="noreferrer">
            NHS MMR guidance
          </a>
        </p>
      </section>
    </main>
  );
}

function MethodologyPage() {
  return (
    <main className="main-content page-shell readable">
      <PageTitle eyebrow="Methodology" title={`How ${brandName} handles the data`} description="Sources, calculations, geography, small-number rules and limitations for the GP-practice postcode indicators." />
      <section className="card prose-card">
        <h2>Project stewardship</h2>
        <p>{brandName} was created and is maintained by <strong>Rory Campbell</strong> as an independent public-interest project. It is not an official NHS or UKHSA service and does not provide medical advice.</p>
      </section>
      <DataNotice />
      <section className="card prose-card">
        <h2>Dates and data updates</h2>
        <p>The reporting period describes when the COVER observations were collected. The source import date records a successful import of the configured workbook; it does not mean a newer release was discovered. Rebuilding the site does not advance that date. The historical dataset has no recorded source import date.</p>
        <p>National comparison points are separately maintained quarterly figures. Updating the GP dataset does not automatically update that series. New UKHSA releases must be reviewed and the configured source links and comparison points updated.</p>
      </section>
      <section className="card prose-card">
        <h2>Count precision and searching</h2>
        <CountNote />
        <p>Full postcodes are reduced to their outward district on your device; the site does not look up your address or identify your GP. Place-name aliases come from the town field of active practices in the NHS ODS epraccur reference. They help find districts and do not define town boundaries or prove a particular practice appears in the COVER sample.</p>
        <p><a href="https://www.odsdatasearchandexport.nhs.uk/api/getReport?report=epraccur" target="_blank" rel="noreferrer">NHS ODS practice reference</a></p>
      </section>
      <section className="card prose-card">
        <h2>Official source</h2>
        <p>The site processes UKHSA COVER supplementary GP-practice data and GP-practice reference data. National comparison figures come from the UKHSA quarterly COVER releases.</p>
        <p><a href="https://www.gov.uk/government/statistics/cover-of-vaccination-evaluated-rapidly-cover-programme-2025-to-2026-quarterly-data" target="_blank" rel="noreferrer">Open the current UKHSA COVER collection</a> · <a href="https://www.gov.uk/government/publications/cover-of-vaccination-evaluated-rapidly-cover-programme-quality-and-methodology-information/quality-and-methodology-information-cover-programme" target="_blank" rel="noreferrer">Read UKHSA quality and methodology information</a></p>
      </section>
      <section className="card prose-card">
        <h2>How an area figure is calculated</h2>
        <ol><li>Download the official GP-level COVER file and practice reference data.</li><li>Join each GP practice code to the postcode of that practice.</li><li>Convert the practice postcode to its outward postcode district, such as FY1 or M15.</li><li>Sum eligible and recorded-vaccinated counts for practices sharing that district.</li><li>Calculate coverage as <code>recorded vaccinated ÷ eligible × 100</code>.</li></ol>
        <p>When combining several districts, the site uses the same eligible-child-weighted calculation. It does not average the displayed district percentages.</p>
      </section>
      <section className="card prose-card">
        <h2>The central geographical limitation</h2>
        <p><strong>The postcode is the location of the GP practice, not the home postcode of each child.</strong> Registered patients can live outside the district. These pages are therefore practice-location indicators and must not be interpreted as resident-population estimates.</p>
        <p>The source is aggregate and cannot identify any child or household. The figures are provisional, can be revised and may be affected by differences in GP systems, patient movement, incomplete records and unmatched practice-reference data.</p>
      </section>
      <section className="card prose-card">
        <h2>How the geographic map is placed</h2>
        <p>Each explorer point is a reference centroid for an outward postcode district represented in the COVER data. It is calculated as the arithmetic mean of live England postcode-unit centroids in the <a href="https://geoportal.statistics.gov.uk/datasets/6fff67d204fd4f339591ed667a6e3642" target="_blank" rel="noreferrer">ONS Postcode Directory (May 2026)</a>. The coastline uses the <a href="https://geoportal.statistics.gov.uk/datasets/818212ae5b2948bcb352842081c03762" target="_blank" rel="noreferrer">ONS Countries (December 2025) ultra-generalised boundary</a>.</p>
        <p>The plotted point is not a postcode-district polygon, patient location or exact practice coordinate. Overlapping points can obscure one another at national zoom, so users can zoom, filter or use the complete results table.</p>
      </section>
      <section className="card prose-card">
        <h2>Coverage bands and small numbers</h2>
        <ul><li><strong>Well below target:</strong> below 90%.</li><li><strong>Below target:</strong> 90% to below 95%.</li><li><strong>Meets target:</strong> 95% or higher.</li></ul>
        <p>These are descriptive coverage bands, not outbreak predictions. Districts with fewer than 30 eligible records receive a small-sample warning and are excluded from homepage lowest-coverage rankings, while remaining visible in the Explorer.</p>
      </section>
      <section className="card prose-card">
        <h2>Reproducibility and licence</h2>
        <p>The processing scripts, normalised CSV/JSON files and validation rules are maintained in the project repository. The pipeline rejects impossible coverage values, aggregates duplicate districts by counts and reports duplicate/unmatched conditions during generation.</p>
        <p>Contains UK Health Security Agency data licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer">Open Government Licence v3.0</a>. Map geography contains OS data © Crown copyright and database right 2026 and Royal Mail data © Royal Mail copyright and database right 2026; source: Office for National Statistics licensed under the Open Government Licence v3.0.</p>
      </section>
    </main>
  );
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function NotFoundPage() {
  return <main className="main-content page-shell centered"><h1>Page not found</h1><p>The app does not have this route.</p><a className="btn btn-red" href="/">Back to {brandName}</a></main>;
}

export default function App() {
  const pathname = window.location.pathname;
  const page = getPageFromPath(pathname);
  const area = getAreaFromPath(pathname);
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Nav />
      <div id="main-content">
        {page === 'home' ? <HomePage /> : null}
        {page === 'towns' ? <TownsPage /> : null}
        {page === 'town' ? <TownPage area={area} /> : null}
        {page === 'map' ? <MapPage /> : null}
        {page === 'myths' ? <MythsPage /> : null}
        {page === 'wakefield' ? <WakefieldPage /> : null}
        {page === 'methodology' ? <MethodologyPage /> : null}
        {page === 'not-found' ? <NotFoundPage /> : null}
      </div>
      <Footer />
    </>
  );
}
