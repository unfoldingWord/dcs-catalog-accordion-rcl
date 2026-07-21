import { useMemo, useState } from 'react';
import DcsCatalogAccordion from './components/DcsCatalogAccordion';
import DcsCatalogBrowser from './components/DcsCatalogBrowser';
import DcsCatalogFilter from './components/DcsCatalogFilter';
import './App.css';

// Dev sandbox demoing every supported embedding: the DcsCatalogBrowser combos a static
// page gets from a single render call, plus the individual components. URL params
// mirror the static-page contract: ?subject=&language=&owner=&stage=&server=&demo=.

const DEFAULT_SUBJECTS = [
    "Aligned Bible",
    "Aramaic Grammar",
    "Bible",
    "Greek Grammar",
    "Greek Lexicon",
    "Greek New Testament",
    "Hebrew Grammar",
    "Hebrew Lexicon",
    "Hebrew Old Testament",
    "Juxtalinear",
    "OBS Study Notes",
    "OBS Study Questions",
    "OBS Translation Notes",
    "OBS Translation Questions",
    "Open Bible Stories",
    "Study Notes",
    "Training Library",
    "Translation Academy",
    "Translation Notes",
    "Translation Questions",
    "Translation Words",
    "TSV OBS Study Notes",
    "TSV OBS Study Questions",
    "TSV OBS Translation Notes",
    "TSV OBS Translation Questions",
    "TSV OBS Translation Words Links",
    "TSV Study Notes",
    "TSV Study Questions",
    "TSV Translation Notes",
    "TSV Translation Questions",
    "TSV Translation Words Links", 
];

const DEMOS = {
  'map-filter-accordion': 'Map + Filter + Accordion',
  'filter-accordion': 'Filter + Accordion',
  'map-accordion': 'Map + Accordion',
  'accordion': 'Accordion only',
  'filter': 'Filter only',
};

// The sandbox defaults to the QA server; use ?server=PROD (or a full URL) to override.
function resolveDcsURL(server) {
  switch ((server || '').toUpperCase()) {
    case 'PROD':
      return 'https://git.door43.org';
    case '':
    case 'QA':
      return 'https://qa.door43.org';
    default:
      return server.startsWith('http') ? server : 'https://qa.door43.org';
  }
}

function App() {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const catalogProps = useMemo(
    () => ({
      subjects: urlParams.getAll('subject').length ? urlParams.getAll('subject') : DEFAULT_SUBJECTS,
      languages: urlParams.getAll('language'),
      owners: urlParams.getAll('owner'),
      stage: urlParams.get('stage') || 'prod',
      dcsURL: resolveDcsURL(urlParams.get('server')),
    }),
    [urlParams]
  );
  const [demo, setDemo] = useState(() => {
    const requested = urlParams.get('demo');
    return requested && requested in DEMOS ? requested : 'map-filter-accordion';
  });
  const [lastFilter, setLastFilter] = useState(null);
  const [lastStats, setLastStats] = useState(null);

  return (
    <div style={{ width: '1024px', fontFamily: 'Roboto, Helvetica, Arial, sans-serif' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '8px 0 16px' }}>
        {Object.entries(DEMOS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setDemo(key)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d8dee4',
              cursor: 'pointer',
              background: demo === key ? '#416a8b' : '#f6f8fa',
              color: demo === key ? 'white' : '#1f2328',
            }}
          >
            {label}
          </button>
        ))}
        {/* Only exists in the built demo site (Netlify), where build:demo copies it in */}
        {import.meta.env.PROD && (
          <a href="./embed.html" style={{ alignSelf: 'center', marginLeft: 'auto', color: '#416a8b' }}>
            Static UMD embed page →
          </a>
        )}
      </div>

      {demo === 'map-filter-accordion' && <DcsCatalogBrowser {...catalogProps} onStatsChange={setLastStats} />}
      {demo === 'filter-accordion' && <DcsCatalogBrowser {...catalogProps} showMap={false} onStatsChange={setLastStats} />}
      {demo === 'map-accordion' && <DcsCatalogBrowser {...catalogProps} showFilter={false} />}
      {demo === 'accordion' && <DcsCatalogAccordion {...catalogProps} />}
      {demo === 'filter' && (
        // Standalone filter: whatever consumes it wires onFilterChange/onStatsChange
        // itself — shown here by dumping the latest payloads.
        <div>
          <DcsCatalogFilter {...catalogProps} onFilterChange={setLastFilter} onStatsChange={setLastStats} />
          <h4 style={{ margin: '16px 0 4px' }}>Last onFilterChange payload</h4>
          <pre style={{ background: '#f6f8fa', padding: '8px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
            {lastFilter ? JSON.stringify(lastFilter, null, 2) : '(nothing selected yet)'}
          </pre>
        </div>
      )}

      {demo !== 'map-accordion' && demo !== 'accordion' && lastStats && (
        <details style={{ margin: '16px 0', color: '#57606a' }}>
          <summary>Last onStatsChange payload (stats-ext)</summary>
          <pre style={{ background: '#f6f8fa', padding: '8px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>{JSON.stringify(lastStats, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export default App;
