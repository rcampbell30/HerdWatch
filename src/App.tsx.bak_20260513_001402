import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { areas, deployedNationalStats } from './data/areas';
import { buildAreaTrend, nationalTrend } from './data/trends';
import type { HerdArea, RiskStatus, TrendPoint } from './types';

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
  englandAverage: latestTrendPoint?.englandMmr1 ?? deployedNationalStats.englandAverage,
  englandMmr2: latestTrendPoint?.englandMmr2,
  latestTrendYear: latestTrendPoint?.year ?? '2024-25'
};

const riskCopy: Record<RiskStatus, { label: string; description: string; className: string }> = {
  AT_RISK: { label: 'AT RISK', description: 'Below 90% — outbreak vulnerability is high.', className: 'risk' },
  VULNERABLE: { label: 'VULNERABLE', description: '90–95% — below the herd-immunity target.', className: 'vulnerable' },
  PROTECTED: { label: 'PROTECTED', description: 'At or above the 95% herd-immunity target.', className: 'protected' }
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

function getPageFromPath(pathname: string): 'home' | 'towns' | 'town' | 'map' | 'myths' | 'methodology' | 'not-found' {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/town/')) return 'town';
  if (pathname.startsWith('/towns')) return 'towns';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname.startsWith('/myths')) return 'myths';
  if (pathname.startsWith('/methodology')) return 'methodology';
  return 'not-found';
}

function Nav() {
  const pathname = window.location.pathname;
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="nav">
      <a className="nav-brand" href="/">Herd<span>Watch</span></a>
      <div className="nav-links">
        <a className={`nav-link ${isActive('/') ? 'active' : ''}`} href="/">Home</a>
        <a className={`nav-link ${isActive('/myths') ? 'active' : ''}`} href="/myths/">The Myth</a>
        <a className={`nav-link ${isActive('/map') ? 'active' : ''}`} href="/map/">Explorer</a>
        <a className={`nav-link ${isActive('/towns') ? 'active' : ''}`} href="/towns/">All Areas</a>
        <a className={`nav-link ${isActive('/methodology') ? 'active' : ''}`} href="/methodology/">Methodology</a>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand">Herd<span>Watch</span></div>
          <div className="footer-copy">Data: {deployedNationalStats.sourceLabel} · postcode-district aggregation</div>
        </div>
        <div className="footer-links">
          <a href="/" className="footer-link">Home</a>
          <a href="/myths/" className="footer-link">The Myth</a>
          <a href="/map/" className="footer-link">Explorer</a>
          <a href="/towns/" className="footer-link">All Areas</a>
          <a href="/methodology/" className="footer-link">Methodology</a>
        </div>
        <div className="footer-copy">Not medical advice. Consult your GP for vaccination guidance.</div>
      </div>
    </footer>
  );
}

function DataNotice() {
  return (
    <div className="notice-card">
      <strong>Data note:</strong> HerdWatch now uses generated NHS COVER area data aggregated from GP-level coverage records into postcode districts. Counts are best read as local coverage indicators, not as household-level or individual-level records.
    </div>
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

  const first = data[0];
  const latest = data[data.length - 1];
  const latestMmr1 = latest.englandMmr1;
  const gap = Number((target - latestMmr1).toFixed(1));
  const hasSeries = data.length > 1;
  const change = hasSeries ? Number((latestMmr1 - first.englandMmr1).toFixed(1)) : 0;
  const direction = change < 0 ? 'fallen' : change > 0 ? 'risen' : 'held flat';
  const values = data.flatMap((point) => [point.englandMmr1, point.englandMmr2, point.selectedArea]).filter((value): value is number => typeof value === 'number');
  const minValue = Math.min(...values);
  const yAxisMin = selectedAreaName ? Math.max(0, Math.floor((minValue - 3) / 10) * 10) : 80;
  const chartData = data.map((point, index) => {
    const isLatest = index === data.length - 1;
    return {
      ...point,
      englandMmr1Label: isLatest ? `MMR1 ${formatPercent(point.englandMmr1)}` : '',
      englandMmr2Label: isLatest ? `MMR2 ${formatPercent(point.englandMmr2)}` : '',
      selectedAreaLabel: isLatest && typeof point.selectedArea === 'number' ? `${selectedAreaName} ${formatPercent(point.selectedArea)}` : ''
    };
  });

  return (
    <section className="card trend-card">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">{hasSeries ? 'Annual COVER series' : 'Latest annual COVER point'}</p>
          <h2 className="card-title">Vaccination coverage {hasSeries ? 'trend' : 'snapshot'}</h2>
        </div>
        <span className="data-badge">Generated COVER data</span>
      </div>
      <div className="chart-wrap" aria-label="MMR vaccination coverage chart">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 12, right: selectedAreaName ? 74 : 66, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis domain={[yAxisMin, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
            <Legend verticalAlign="top" height={30} />
            <ReferenceLine y={target} label="95% target" stroke={LINE_TARGET} strokeDasharray="5 5" strokeWidth={2} />
            <Line type="monotone" dataKey="englandMmr1" name="England MMR1" stroke={LINE_MMR1} strokeWidth={3} dot>
              <LabelList dataKey="englandMmr1Label" position="right" fill={LINE_MMR1} fontSize={12} />
            </Line>
            <Line type="monotone" dataKey="englandMmr2" name="England MMR2" stroke={LINE_MMR2} strokeWidth={3} dot>
              <LabelList dataKey="englandMmr2Label" position="right" fill={LINE_MMR2} fontSize={12} />
            </Line>
            {selectedAreaName ? (
              <Line type="monotone" dataKey="selectedArea" name={selectedAreaName} stroke={LINE_AREA} strokeWidth={3} dot>
                <LabelList dataKey="selectedAreaLabel" position="right" fill={LINE_AREA} fontSize={12} />
              </Line>
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="trend-insight">
        {hasSeries ? (
          <><strong>Insight:</strong> England MMR1 coverage has {direction} by {Math.abs(change).toFixed(1)} percentage points across the generated annual series and is currently {gap.toFixed(1)} points below the 95% target.</>
        ) : (
          <><strong>Insight:</strong> the current generated trend file contains one annual COVER point. It shows England MMR1 at {formatPercent(latest.englandMmr1)} and England MMR2 at {formatPercent(latest.englandMmr2)} for {latest.year}.</>
        )}
      </div>
    </section>
  );
}

function Hero({ onSearch }: { onSearch: (value: string) => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return [];
    return areas.filter((area) => area.postcodeDistrict.includes(trimmed) || area.region.toUpperCase().includes(trimmed)).slice(0, 8);
  }, [query]);

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="hero-tag">{deployedNationalStats.sourceLabel}</div>
        <h1 className="hero-title">MMR vaccination<br />coverage <em>tracker</em></h1>
        <p className="hero-sub">Find MMR coverage rates, local vulnerability and herd-immunity gaps across England.</p>
        <div className="search-wrap">
          <input className="search-input" placeholder="Search postcode district — FY1, M15, LS12..." value={query} onChange={(event) => handleChange(event.target.value)} />
          {results.length > 0 ? (
            <div className="search-dropdown">
              {results.map((area) => (
                <a key={area.postcodeDistrict} href={`/town/${area.postcodeDistrict.toLowerCase()}/`} className="search-item">
                  <span>{area.postcodeDistrict} · {area.region}</span>
                  <strong>{formatPercent(area.coverage)}</strong>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatGrid() {
  return (
    <div className="stats-grid">
      <div className="stat-card risk"><div className="stat-num risk">{liveAreaStats.atRiskAreas.toLocaleString()}</div><div className="stat-label">AT RISK</div><div className="stat-desc">Postcode districts below 90%</div></div>
      <div className="stat-card vulnerable"><div className="stat-num vulnerable">{liveAreaStats.vulnerableAreas.toLocaleString()}</div><div className="stat-label">VULNERABLE</div><div className="stat-desc">Postcode districts 90–95%</div></div>
      <div className="stat-card protected"><div className="stat-num protected">{liveAreaStats.protectedAreas.toLocaleString()}</div><div className="stat-label">PROTECTED</div><div className="stat-desc">Postcode districts at or above 95%</div></div>
      <div className="stat-card total"><div className="stat-num">{liveAreaStats.totalAreasTracked.toLocaleString()}</div><div className="stat-label">TOTAL AREAS</div><div className="stat-desc">Imported postcode districts</div></div>
    </div>
  );
}

function NationalPicture() {
  return (
    <>
      <SectionHeader title="National Picture" />
      <div className="context-card">
        <div className="context-item"><div className="context-val risk-text">{formatPercent(liveAreaStats.englandAverage)}</div><div className="context-item-label">England MMR1</div><div className="context-item-sub">Generated annual COVER point for {liveAreaStats.latestTrendYear}, below the 95% target.</div></div>
        <div className="context-item bordered"><div className="context-val protected-text">{target}%</div><div className="context-item-label">Coverage Target</div><div className="context-item-sub">The working threshold HerdWatch uses to flag local vulnerability.</div></div>
        <div className="context-item"><div className="context-val vulnerable-text">{liveAreaStats.unvaccinatedChildren.toLocaleString()}</div><div className="context-item-label">Unvaccinated Estimate</div><div className="context-item-sub">Approximate count across imported GP-level area records after postcode-district aggregation.</div></div>
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
      <div><div className="town-district">{area.postcodeDistrict}</div><div className="town-meta">{area.practiceCount} practices · {area.region}</div></div>
      <div className="town-card-right"><div className={`town-cov ${meta.className}-text`}>{formatPercent(area.coverage)}</div><div className={`town-badge ${meta.className}`}>{meta.label}</div></div>
    </a>
  );
}

function HomePage() {
  const highestRisk = [...areas].sort((a, b) => a.coverage - b.coverage).slice(0, 18);
  return (
    <>
      <Hero onSearch={() => undefined} />
      <div className="counter-bar"><div className="counter-inner"><div className="counter-num">{liveAreaStats.unvaccinatedChildren.toLocaleString()}</div><div className="counter-label">children in imported GP coverage rows not counted as vaccinated<br />after postcode-district aggregation</div></div></div>
      <main className="main-content">
        <DataNotice />
        <StatGrid />
        <NationalPicture />
        <TrendChart data={nationalTrend} />
        <SectionHeader title="Highest Risk Areas" />
        <p className="section-note">Postcode districts with MMR coverage below 90% — sorted by lowest coverage first.</p>
        <div className="worst-grid">{highestRisk.map((area) => <AreaCard key={area.postcodeDistrict} area={area} />)}</div>
        <div className="cta-row"><a className="btn btn-red" href="/map/">Open Explorer →</a><a className="btn btn-dark" href="/towns/">All Areas →</a><a className="btn btn-outline" href="/methodology/">Methodology</a></div>
      </main>
    </>
  );
}

function TownsPage() {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(80);
  const filtered = useMemo(() => {
    const trimmed = query.trim().toUpperCase();
    return [...areas].filter((area) => !trimmed || area.postcodeDistrict.includes(trimmed) || area.region.toUpperCase().includes(trimmed)).sort((a, b) => a.coverage - b.coverage);
  }, [query]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <main className="main-content page-shell">
      <PageTitle eyebrow="All areas" title="Vaccination coverage by postcode district" description={`Search ${liveAreaStats.totalAreasTracked.toLocaleString()} postcode districts generated from NHS COVER GP-level area data.`} />
      <DataNotice />
      <input className="search-input light" placeholder="Search area or region" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(80); }} />
      <div className="table-card">
        <table>
          <thead><tr><th>Area</th><th>Region</th><th>Practices</th><th>Coverage</th><th>Status</th><th>Gap to 95%</th></tr></thead>
          <tbody>
            {visible.map((area) => (
              <tr key={area.postcodeDistrict}>
                <td><a href={`/town/${area.postcodeDistrict.toLowerCase()}/`}>{area.postcodeDistrict}</a></td>
                <td>{area.region}</td><td>{area.practiceCount}</td><td>{formatPercent(area.coverage)}</td>
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
      <section className="hero-band"><div className="hero-inner"><div className="breadcrumb"><a className="bc-link" href="/">Home</a><span className="bc-sep">/</span><a className="bc-link" href="/towns/">Areas</a><span className="bc-sep">/</span><span className="bc-cur">{area.postcodeDistrict}</span></div><h1 className="hero-title"><span className="postcode">{area.postcodeDistrict}</span> vaccination coverage</h1></div></section>
      <main className="content-layout">
        <section className="main-col">
          <div className={`status-banner ${meta.className}`}><div><div className="status-threat">Threat level</div><div className="status-label">{meta.label}</div><div className="status-desc">{meta.description}</div></div><div className="status-right"><div className="big-coverage">{formatPercent(area.coverage)}</div><div className="cov-label">MMR1 coverage at 24 months</div></div></div>
          <div className="metric-grid card"><Metric label="Eligible children" value={area.totalEligible.toLocaleString()} /><Metric label="Vaccinated" value={area.totalVaccinated.toLocaleString()} /><Metric label="Unvaccinated" value={unvaccinated(area).toLocaleString()} /><Metric label="Needed for 95%" value={neededForTarget(area).toLocaleString()} /></div>
          <TrendChart data={areaTrend} selectedAreaName={area.postcodeDistrict} />
          <section className="card"><h2 className="card-title">How to read this</h2><p className="body-copy">Coverage below 95% means measles can spread more easily if it enters the community. Coverage below 90% is treated here as a clearer local warning signal, not a diagnosis of an outbreak. Postcode-district figures are generated from GP-level source records, so they are a local signal rather than a household-level measurement.</p></section>
        </section>
        <aside className="side-col">
          <div className="side-card"><h2 className="side-title">Area summary</h2><div className="fact-item"><span>📍</span><p>{area.postcodeDistrict} is in {area.region}.</p></div><div className="fact-item"><span>🏥</span><p>{area.practiceCount} practices are represented in the imported GP-level COVER records for this postcode district.</p></div><div className="fact-item"><span>🎯</span><p>Gap to target: {Math.max(0, target - area.coverage).toFixed(1)} percentage points.</p></div></div>
          <div className="side-card"><h2 className="side-title">Nearby / similar areas</h2>{nearby.map((item) => <AreaCard key={item.postcodeDistrict} area={item} />)}</div>
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
  return (
    <main className="main-content page-shell">
      <PageTitle eyebrow="Explorer" title="Coverage explorer" description="Search and filter generated NHS COVER postcode-district area data by region, coverage and risk band." />
      <p className="section-note">The live /map/ route is served as an interactive coverage dashboard that reads from /data/areas.json.</p>
      <div className="map-placeholder">{areas.slice(0, 18).map((area) => <a key={area.postcodeDistrict} className={`map-cell ${riskCopy[area.status].className}`} href={`/town/${area.postcodeDistrict.toLowerCase()}/`}><strong>{area.postcodeDistrict}</strong><span>{formatPercent(area.coverage)}</span></a>)}</div>
    </main>
  );
}

function MythsPage() {
  return <main className="main-content page-shell readable"><PageTitle eyebrow="The myth" title="Herd immunity is not magic" description="It is a threshold effect: when enough people are immune, infections have fewer routes through a community." /><section className="card prose-card"><h2>Why the 95% line matters</h2><p>Measles is unusually infectious. Small drops in vaccination coverage can therefore create large changes in local outbreak vulnerability.</p><p>HerdWatch should avoid shaming individual families. The stronger civic angle is: low coverage reveals a system-level vulnerability, especially for babies, immunocompromised people and anyone who cannot be vaccinated.</p></section></main>;
}

function MethodologyPage() {
  return (
    <main className="main-content page-shell readable">
      <PageTitle eyebrow="Methodology" title="How HerdWatch handles the data" description="A plain-English summary of the current NHS COVER import and postcode-district aggregation." />
      <section className="card prose-card"><h2>Current data status</h2><p>HerdWatch now uses generated area data from NHS COVER GP-level records, aggregated into postcode districts and risk bands. The public explorer reads the generated JSON file at <code>/data/areas.json</code>.</p><h2>Area aggregation</h2><ol><li>Download official NHS COVER supplementary GP-level files and GP practice reference data.</li><li>Join GP practice codes to practice postcodes.</li><li>Convert practice postcodes into outward postcode districts.</li><li>Aggregate eligible and vaccinated counts by postcode district.</li><li>Assign risk bands using the 90% and 95% coverage thresholds.</li></ol><h2>Important limitation</h2><p>Postcode-district figures are local coverage indicators derived from GP-level source records. They are not household-level records and should not be used to identify individual vaccination status.</p></section>
    </main>
  );
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>;
}

function NotFoundPage() {
  return <main className="main-content page-shell centered"><h1>Page not found</h1><p>The app does not have this route.</p><a className="btn btn-red" href="/">Back to HerdWatch</a></main>;
}

export default function App() {
  const pathname = window.location.pathname;
  const page = getPageFromPath(pathname);
  const area = getAreaFromPath(pathname);
  return (
    <>
      <Nav />
      {page === 'home' ? <HomePage /> : null}
      {page === 'towns' ? <TownsPage /> : null}
      {page === 'town' ? <TownPage area={area} /> : null}
      {page === 'map' ? <MapPage /> : null}
      {page === 'myths' ? <MythsPage /> : null}
      {page === 'methodology' ? <MethodologyPage /> : null}
      {page === 'not-found' ? <NotFoundPage /> : null}
      <Footer />
    </>
  );
}
