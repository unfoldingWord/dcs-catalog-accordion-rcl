// React imports
import { useCallback, useMemo, useState } from 'react';

// Prop Types for type checking in React
import PropTypes from 'prop-types';

import DcsCatalogAccordion from './DcsCatalogAccordion';
import DcsCatalogFilter from './DcsCatalogFilter';
import WorldLanguageMap from './WorldLanguageMap';
import { DEFAULT_DCS_URL, DEFAULT_STAGE } from '../lib/dcsApi';

const EMPTY_ARRAY = [];

// Composes the world map, the stats filter and the catalog accordion with shared
// state: map clicks become the filter's language selection, and the filter's effective
// output drives the accordion. showMap/showFilter turn the extra pieces off, so a
// static page gets any combination from a single createRoot().render() call — the
// individual components remain exported for fully custom wiring.
const DcsCatalogBrowser = ({
  subjects = EMPTY_ARRAY,
  languages = EMPTY_ARRAY,
  owners = EMPTY_ARRAY,
  stage = DEFAULT_STAGE,
  dcsURL = DEFAULT_DCS_URL,
  showMap = true,
  showFilter = true,
  onFilterChange,
  onStatsChange,
}) => {
  const [filter, setFilter] = useState(null);
  const [mapLanguages, setMapLanguages] = useState(null);

  const handleFilterChange = useCallback(
    (next) => {
      // Keep the previous object when nothing actually changed so the accordion's
      // effects (which key off array identity) don't refetch needlessly.
      setFilter((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      onFilterChange?.(next);
    },
    [onFilterChange]
  );

  // A fresh array per click lets clicking the same continent again re-apply the
  // region after the user has edited the language selection by hand.
  const handleContinentClick = useCallback((langs) => {
    setMapLanguages([...(langs || [])]);
  }, []);

  const accordionProps = useMemo(() => {
    if (showFilter && filter) {
      return {
        subjects: filter.subjects,
        languages: filter.languages,
        owners: filter.owners,
        stage: filter.stage,
        mediaTypes: filter.mediaTypes,
        dcsURL,
      };
    }
    // Without the filter, map clicks drive the accordion directly (the map's
    // "Show All" sends an empty list, which falls back to the given languages).
    const effectiveLanguages = !showFilter && mapLanguages?.length ? mapLanguages : languages;
    return { subjects, languages: effectiveLanguages, owners, stage, mediaTypes: EMPTY_ARRAY, dcsURL };
  }, [showFilter, filter, mapLanguages, subjects, languages, owners, stage, dcsURL]);

  return (
    <div>
      {showMap && <WorldLanguageMap onContinentClick={handleContinentClick} />}
      {showFilter && (
        <DcsCatalogFilter
          subjects={subjects}
          languages={languages}
          owners={owners}
          stage={stage}
          dcsURL={dcsURL}
          selectedLanguages={showMap ? mapLanguages : undefined}
          onFilterChange={handleFilterChange}
          onStatsChange={onStatsChange}
        />
      )}
      <DcsCatalogAccordion {...accordionProps} />
    </div>
  );
};

DcsCatalogBrowser.propTypes = {
  subjects: PropTypes.array,
  languages: PropTypes.array,
  owners: PropTypes.array,
  stage: PropTypes.string,
  dcsURL: PropTypes.string,
  showMap: PropTypes.bool,
  showFilter: PropTypes.bool,
  onFilterChange: PropTypes.func,
  onStatsChange: PropTypes.func,
};

export default DcsCatalogBrowser;
