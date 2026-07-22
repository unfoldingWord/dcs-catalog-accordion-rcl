// React imports
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Prop Types for type checking in React
import PropTypes from 'prop-types';

// Axios for making HTTP requests
import axios from 'axios';

// Material UI components
import {
  Autocomplete,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';

import { API_PATH, DEFAULT_DCS_URL, DEFAULT_STAGE, MEDIA_TYPE_OPTIONS, buildQueryString, mediaTypeParams } from '../lib/dcsApi';

const EMPTY_ARRAY = [];

// Newer DCS servers return stats-ext subjects/owners/languages as {value: entryCount}
// maps; older ones return plain lists. Normalize both to a map (null = count unknown).
function normalizeStatsList(listOrMap) {
  if (!listOrMap) {
    return {};
  }
  if (Array.isArray(listOrMap)) {
    return Object.fromEntries(listOrMap.map((value) => [value, null]));
  }
  return listOrMap;
}

// DCS represents the TSV-format variant of a resource as its own subject named
// "TSV <subject>" (e.g. "TSV OBS Translation Notes"). The dropdown hides that
// distinction: options are merged under the TSV-stripped base name (counts summed),
// and outgoing subject queries expand a base name back to every concrete variant
// known to exist in the universe.
const TSV_PREFIX = 'TSV ';

const stripTsvPrefix = (subject) => (subject.startsWith(TSV_PREFIX) ? subject.slice(TSV_PREFIX.length) : subject);

// Records concrete subject spellings into byBase (lowercased base name → Map of
// lowercased spelling → spelling), the knowledge expandSubjects draws on.
const addKnownSubjects = (byBase, values) => {
  values.forEach((subject) => {
    const base = stripTsvPrefix(subject).toLowerCase();
    let forms = byBase.get(base);
    if (!forms) {
      forms = new Map();
      byBase.set(base, forms);
    }
    if (!forms.has(subject.toLowerCase())) {
      forms.set(subject.toLowerCase(), subject);
    }
  });
};

// Expands subjects to every concrete variant sharing their base name, so querying
// "OBS Translation Notes" also queries "TSV OBS Translation Notes" when the universe
// has it. Names with no recorded variants pass through unchanged.
const expandSubjects = (byBase, list) => {
  const seen = new Set();
  const expanded = [];
  list.forEach((subject) => {
    const forms = byBase.get(stripTsvPrefix(subject).toLowerCase());
    (forms?.size ? Array.from(forms.values()) : [subject]).forEach((value) => {
      if (!seen.has(value.toLowerCase())) {
        seen.add(value.toLowerCase());
        expanded.push(value);
      }
    });
  });
  return expanded;
};

// MUI Autocomplete warns when a selected value is missing from the options, which can
// happen while the facet option lists are narrowing; keep every selected value listed.
function withSelected(options, selected) {
  const seen = new Set(options.map((option) => option.toLowerCase()));
  const merged = [...options];
  selected.forEach((value) => {
    if (!seen.has(value.toLowerCase())) {
      merged.push(value);
    }
  });
  return merged;
}

// A filter bar over the DCS catalog driven by the catalog/stats-ext endpoint: subject,
// language and publisher (owner) autocompletes plus a "Has Media" dropdown, with a
// stats summary line underneath. The subjects/languages/owners props define the
// universe being filtered (empty means the whole catalog); every selection change
// re-queries stats-ext so each facet's options only offer values that still match the
// other facets. "TSV "-prefixed subjects are folded into their base subject
// throughout: one merged dropdown option with a summed count, with every outgoing
// subject list (queries and the onFilterChange payload) expanded back to the concrete
// variants. The effective filter is reported through onFilterChange so a parent
// can drive DcsCatalogAccordion (or anything else) with it.
const DcsCatalogFilter = ({
  subjects = EMPTY_ARRAY,
  languages = EMPTY_ARRAY,
  owners = EMPTY_ARRAY,
  stage = DEFAULT_STAGE,
  dcsURL = DEFAULT_DCS_URL,
  selectedLanguages = null,
  onFilterChange,
  onStatsChange,
}) => {
  const [selSubjects, setSelSubjects] = useState([]);
  const [selLangs, setSelLangs] = useState([]);
  const [selOwners, setSelOwners] = useState([]);
  const [selMedia, setSelMedia] = useState([]);
  const [stats, setStats] = useState(null);
  // Per-facet {value: entryCount} maps, each from a stats-ext query that omits the
  // facet's own selection (so a selected subject doesn't shrink the subject dropdown
  // to itself). The counts label each dropdown option, like the Media dropdown's.
  const [facetOptions, setFacetOptions] = useState(null);
  // Owner/language display details, keyed by lowercased username / language code:
  // catalog/list/owners supplies full_name, catalog/list/languages supplies ln/ang and
  // the canonical (mixed-case) lc that the accordion's tree is keyed by.
  const [ownersInfo, setOwnersInfo] = useState({});
  const [langsInfo, setLangsInfo] = useState({});
  const [loading, setLoading] = useState(true);
  // Language codes pushed in via the selectedLanguages prop (e.g. a world-map region)
  // wait here until langsInfo can canonicalize them and drop unknown codes — region
  // lists hold thousands of codes that would otherwise blow up the query string.
  const [pendingPush, setPendingPush] = useState(null);

  // Effects read props/selections/callbacks through refs so their dependency lists can
  // be value signatures (plain strings) instead of array identities, which consumers —
  // especially static pages — recreate on every render.
  const propsRef = useRef({});
  propsRef.current = { subjects, languages, owners, stage, dcsURL };
  const selectionsRef = useRef({});
  selectionsRef.current = { selSubjects, selLangs, selOwners, selMedia };
  const onFilterChangeRef = useRef();
  onFilterChangeRef.current = onFilterChange;
  const onStatsChangeRef = useRef();
  onStatsChangeRef.current = onStatsChange;

  const propsSig = JSON.stringify([subjects, languages, owners, stage, dcsURL]);
  const selectionsSig = JSON.stringify([selSubjects, selLangs, selOwners, selMedia]);

  // Concrete subject spellings known to exist in the current universe — the subjects
  // prop plus everything stats-ext has reported for it — keyed by base name. Kept in
  // a ref (reseeded here whenever the universe changes, before any effect runs) so
  // effects can expand subject queries without extra dependencies, and so another
  // universe's TSV variants can never leak in.
  const subjectVariantsRef = useRef(null);
  if (subjectVariantsRef.current?.sig !== propsSig) {
    subjectVariantsRef.current = { sig: propsSig, byBase: new Map() };
    addKnownSubjects(subjectVariantsRef.current.byBase, subjects);
  }

  // A different universe (new props) invalidates any current selections.
  const prevPropsSigRef = useRef(propsSig);
  useEffect(() => {
    if (prevPropsSigRef.current === propsSig) {
      return;
    }
    prevPropsSigRef.current = propsSig;
    setSelSubjects([]);
    setSelLangs([]);
    setSelOwners([]);
    setSelMedia([]);
  }, [propsSig]);

  // Owner and language details are only needed once per universe: both lists cover
  // everything the narrower stats-ext queries can ever return.
  useEffect(() => {
    const { subjects, languages, owners, stage, dcsURL } = propsRef.current;
    const query = buildQueryString({
      subject: expandSubjects(subjectVariantsRef.current.byBase, subjects),
      lang: languages.map((lc) => lc.toLowerCase()),
      owner: owners,
      stage: stage || DEFAULT_STAGE,
    });
    let cancelled = false;
    (async () => {
      try {
        const [ownersResponse, langsResponse] = await Promise.all([
          axios.get(`${dcsURL}/${API_PATH}/catalog/list/owners?${query}`),
          axios.get(`${dcsURL}/${API_PATH}/catalog/list/languages?${query}`),
        ]);
        if (cancelled) {
          return;
        }
        const newOwnersInfo = {};
        (ownersResponse.data.data || []).forEach((info) => {
          newOwnersInfo[info.username.toLowerCase()] = info;
        });
        const newLangsInfo = {};
        (langsResponse.data.data || []).forEach((info) => {
          newLangsInfo[info.lc.toLowerCase()] = info;
        });
        setOwnersInfo(newOwnersInfo);
        setLangsInfo(newLangsInfo);
      } catch (error) {
        console.error('Failed to fetch owner/language details', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propsSig]);

  // Re-query stats-ext whenever the selections (or the universe) change: one query with
  // every effective param for the stats line, plus one per facet with that facet's own
  // selection swapped back to its default so its options stay selectable. Identical
  // queries are deduped, so with nothing selected this is a single request.
  useEffect(() => {
    const { subjects, languages, owners, stage, dcsURL } = propsRef.current;
    const { selSubjects, selLangs, selOwners, selMedia } = selectionsRef.current;
    const { byBase } = subjectVariantsRef.current;
    const lower = (values) => values.map((value) => value.toLowerCase());
    const mainParams = {
      subject: expandSubjects(byBase, selSubjects.length ? selSubjects : subjects),
      lang: lower(selLangs.length ? selLangs : languages),
      owner: selOwners.length ? selOwners : owners,
      stage: stage || DEFAULT_STAGE,
      ...mediaTypeParams(selMedia),
    };
    const requests = new Map();
    const getStats = (params) => {
      const query = buildQueryString(params);
      if (!requests.has(query)) {
        requests.set(query, axios.get(`${dcsURL}/${API_PATH}/catalog/stats-ext?${query}`).then((response) => response.data));
      }
      return requests.get(query);
    };
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [main, forSubjects, forLangs, forOwners] = await Promise.all([
          getStats(mainParams),
          getStats({ ...mainParams, subject: expandSubjects(byBase, subjects) }),
          getStats({ ...mainParams, lang: lower(languages) }),
          getStats({ ...mainParams, owner: owners }),
        ]);
        if (cancelled) {
          return;
        }
        setStats(main);
        // Newly learned "TSV X" subjects make later queries for "X" cover both.
        addKnownSubjects(byBase, Object.keys(normalizeStatsList(forSubjects.subjects)));
        setFacetOptions({
          subjects: normalizeStatsList(forSubjects.subjects),
          languages: normalizeStatsList(forLangs.languages),
          owners: normalizeStatsList(forOwners.owners),
        });
        onStatsChangeRef.current?.(main);
      } catch (error) {
        console.error('Failed to fetch catalog stats', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propsSig, selectionsSig]);

  // Report the effective filter upward on every selection change (skipping mount — the
  // parent already knows the defaults it passed in).
  const lastEmittedSigRef = useRef(null);
  useEffect(() => {
    if (lastEmittedSigRef.current === null) {
      lastEmittedSigRef.current = selectionsSig;
      return;
    }
    if (lastEmittedSigRef.current === selectionsSig) {
      return;
    }
    lastEmittedSigRef.current = selectionsSig;
    const { subjects, languages, owners, stage } = propsRef.current;
    const { selSubjects, selLangs, selOwners, selMedia } = selectionsRef.current;
    onFilterChangeRef.current?.({
      subjects: expandSubjects(subjectVariantsRef.current.byBase, selSubjects.length ? selSubjects : subjects),
      languages: selLangs.length ? selLangs : languages,
      owners: selOwners.length ? selOwners : owners,
      stage: stage || DEFAULT_STAGE,
      mediaTypes: selMedia,
      isFiltered: selSubjects.length > 0 || selLangs.length > 0 || selOwners.length > 0 || selMedia.length > 0,
    });
  }, [selectionsSig]);

  useEffect(() => {
    if (selectedLanguages == null) {
      return;
    }
    setPendingPush(selectedLanguages);
  }, [selectedLanguages]);

  useEffect(() => {
    if (!pendingPush) {
      return;
    }
    if (!Object.keys(langsInfo).length) {
      return; // language details still loading; this re-runs when they arrive
    }
    const seen = new Set();
    const next = [];
    pendingPush.forEach((code) => {
      const canonical = langsInfo[String(code).toLowerCase()]?.lc;
      if (canonical && !seen.has(canonical.toLowerCase())) {
        seen.add(canonical.toLowerCase());
        next.push(canonical);
      }
    });
    setSelLangs(next);
    setPendingPush(null);
  }, [pendingPush, langsInfo]);

  const isFiltered = selSubjects.length > 0 || selLangs.length > 0 || selOwners.length > 0 || selMedia.length > 0;

  const languageLabel = useCallback(
    (lc) => {
      const info = langsInfo[lc.toLowerCase()];
      if (!info?.ln) {
        return lc;
      }
      return info.ang && info.ang !== info.ln ? `${info.ln} (${info.ang})` : info.ln;
    },
    [langsInfo]
  );

  const ownerLabel = useCallback(
    (username) => {
      const info = ownersInfo[username.toLowerCase()];
      if (!info?.full_name) {
        return info?.username || username;
      }
      const sameAsUsername = info.full_name.toLowerCase().replace(/[^a-z0-9_.-]/g, '') === info.username.toLowerCase();
      return sameAsUsername ? info.full_name : `${info.full_name} (${info.username})`;
    },
    [ownersInfo]
  );

  // Each facet's options: the given prop list verbatim while nothing is selected (it
  // may deliberately be wider than what stats-ext returns), otherwise the facet's
  // latest stats-ext list. Languages/owners are canonicalized through langsInfo /
  // ownersInfo since stats-ext reports lowercased values.
  const subjectOptions = useMemo(() => {
    const source = !isFiltered && subjects.length ? subjects : facetOptions ? Object.keys(facetOptions.subjects) : subjects;
    // One merged option per TSV-stripped base name ("TSV OBS Translation Notes"
    // collapses into "OBS Translation Notes").
    const seen = new Set();
    const options = [];
    source.forEach((subject) => {
      const base = stripTsvPrefix(subject);
      if (!seen.has(base.toLowerCase())) {
        seen.add(base.toLowerCase());
        options.push(base);
      }
    });
    return withSelected(options.sort((a, b) => a.localeCompare(b)), selSubjects);
  }, [isFiltered, subjects, facetOptions, selSubjects]);

  const languageOptions = useMemo(() => {
    const source = !isFiltered && languages.length ? languages : facetOptions ? Object.keys(facetOptions.languages) : languages;
    const seen = new Set();
    const options = [];
    source.forEach((lc) => {
      const canonical = langsInfo[lc.toLowerCase()]?.lc || lc;
      if (!seen.has(canonical.toLowerCase())) {
        seen.add(canonical.toLowerCase());
        options.push(canonical);
      }
    });
    options.sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)));
    return withSelected(options, selLangs);
  }, [isFiltered, languages, facetOptions, langsInfo, languageLabel, selLangs]);

  const ownerOptions = useMemo(() => {
    const source = !isFiltered && owners.length ? owners : facetOptions ? Object.keys(facetOptions.owners) : owners;
    const seen = new Set();
    const options = [];
    source.forEach((owner) => {
      const canonical = ownersInfo[owner.toLowerCase()]?.username || owner;
      if (!seen.has(canonical.toLowerCase())) {
        seen.add(canonical.toLowerCase());
        options.push(canonical);
      }
    });
    options.sort((a, b) => ownerLabel(a).localeCompare(ownerLabel(b)));
    return withSelected(options, selOwners);
  }, [isFiltered, owners, facetOptions, ownersInfo, ownerLabel, selOwners]);

  // Entry counts for dropdown options, from the same per-facet stats queries the
  // options come from. Language counts sum casing variants (stats-ext can report the
  // same code twice, e.g. ur-deva and ur-Deva, which the options dedupe); owners are
  // reported lowercased. Null when the server predates counts or the value is absent.
  // A merged subject option counts every concrete variant of its base name ("OBS
  // Translation Notes" sums "OBS Translation Notes" and "TSV OBS Translation Notes").
  const subjectCount = useCallback(
    (subject) => {
      const base = stripTsvPrefix(subject).toLowerCase();
      let total = null;
      Object.entries(facetOptions?.subjects || {}).forEach(([value, count]) => {
        if (stripTsvPrefix(value).toLowerCase() === base && typeof count === 'number') {
          total = (total || 0) + count;
        }
      });
      return total;
    },
    [facetOptions]
  );

  const languageCount = useCallback(
    (lc) => {
      let total = null;
      Object.entries(facetOptions?.languages || {}).forEach(([code, count]) => {
        if (code.toLowerCase() === lc.toLowerCase() && typeof count === 'number') {
          total = (total || 0) + count;
        }
      });
      return total;
    },
    [facetOptions]
  );

  const ownerCount = useCallback(
    (owner) => facetOptions?.owners?.[owner.toLowerCase()] ?? facetOptions?.owners?.[owner] ?? null,
    [facetOptions]
  );

  // Counts appear only in the open dropdowns (like the Media dropdown), not in the
  // selected-value chips, so the labels used for chips/matching stay clean.
  const renderOptionWithCount = (getLabel, getCount) =>
    function OptionWithCount(props, option) {
      // eslint-disable-next-line react/prop-types
      const { key, ...optionProps } = props;
      const count = getCount(option);
      return (
        <li key={key} {...optionProps}>
          {getLabel(option)}
          {typeof count === 'number' ? ` (${count.toLocaleString()})` : ''}
        </li>
      );
    };

  const filterLanguageOptions = (options, { inputValue }) => {
    const query = inputValue.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((lc) => {
      const info = langsInfo[lc.toLowerCase()];
      return lc.toLowerCase().includes(query) || info?.ln?.toLowerCase().includes(query) || info?.ang?.toLowerCase().includes(query);
    });
  };

  const filterOwnerOptions = (options, { inputValue }) => {
    const query = inputValue.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((username) => {
      const info = ownersInfo[username.toLowerCase()];
      return username.toLowerCase().includes(query) || info?.full_name?.toLowerCase().includes(query);
    });
  };

  const equalsIgnoreCase = (option, value) => option.toLowerCase() === value.toLowerCase();

  const handleClearFilters = () => {
    setSelSubjects([]);
    setSelLangs([]);
    setSelOwners([]);
    setSelMedia([]);
    setPendingPush(null);
  };

  return (
    <div style={{ fontFamily: 'Roboto, Helvetica, Arial, sans-serif', color: '#1f2328', margin: '8px 0 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <Autocomplete
          multiple
          size="small"
          limitTags={2}
          options={subjectOptions}
          value={selSubjects}
          loading={!facetOptions}
          renderOption={renderOptionWithCount((subject) => subject, subjectCount)}
          onChange={(event, value) => setSelSubjects(value)}
          renderInput={(params) => <TextField {...params} label="Resources" placeholder={selSubjects.length ? '' : 'All resources'} />}
          sx={{ flex: '1 1 240px', minWidth: '240px' }}
        />
        <Autocomplete
          multiple
          size="small"
          limitTags={2}
          options={languageOptions}
          value={selLangs}
          loading={!facetOptions}
          getOptionLabel={languageLabel}
          filterOptions={filterLanguageOptions}
          isOptionEqualToValue={equalsIgnoreCase}
          renderOption={renderOptionWithCount(languageLabel, languageCount)}
          onChange={(event, value) => setSelLangs(value)}
          renderInput={(params) => <TextField {...params} label="Languages" placeholder={selLangs.length ? '' : 'All languages'} />}
          sx={{ flex: '1 1 240px', minWidth: '240px' }}
        />
        <Autocomplete
          multiple
          size="small"
          limitTags={2}
          options={ownerOptions}
          value={selOwners}
          loading={!facetOptions}
          getOptionLabel={ownerLabel}
          filterOptions={filterOwnerOptions}
          isOptionEqualToValue={equalsIgnoreCase}
          renderOption={renderOptionWithCount(ownerLabel, ownerCount)}
          onChange={(event, value) => setSelOwners(value)}
          renderInput={(params) => <TextField {...params} label="Publishers" placeholder={selOwners.length ? '' : 'All publishers'} />}
          sx={{ flex: '1 1 240px', minWidth: '240px' }}
        />
        <FormControl size="small" sx={{ flex: '0 1 200px', minWidth: '160px' }}>
          <InputLabel id="dcs-catalog-filter-media-label">Media</InputLabel>
          <Select
            multiple
            labelId="dcs-catalog-filter-media-label"
            value={selMedia}
            input={<OutlinedInput label="Media" />}
            onChange={(event) => {
              const { value } = event.target;
              setSelMedia(typeof value === 'string' ? value.split(',') : value);
            }}
            renderValue={(selected) => selected.map((value) => MEDIA_TYPE_OPTIONS.find((option) => option.value === value)?.label || value).join(', ')}
          >
            {MEDIA_TYPE_OPTIONS.map(({ value, label, statKey }) => (
              <MenuItem key={value} value={value}>
                <Checkbox size="small" checked={selMedia.includes(value)} />
                {/* Counts come from the latest stats-ext response and refresh with it */}
                <ListItemText primary={stats ? `${label} (${(stats[statKey] ?? 0).toLocaleString()})` : label} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
      <Typography variant="body2" component="div" sx={{ marginTop: '8px', color: '#57606a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {stats ? (
          <span>
            Total Entries: {stats.entry_count?.toLocaleString()}, Total Languages: {stats.lang_count?.toLocaleString()}
          </span>
        ) : (
          <span>Loading catalog stats…</span>
        )}
        {loading && <CircularProgress size={14} />}
      </Typography>
      {isFiltered && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
          <Button variant="outlined" size="small" startIcon={<FilterAltOffIcon />} onClick={handleClearFilters}>
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};

DcsCatalogFilter.propTypes = {
  subjects: PropTypes.array,
  languages: PropTypes.array,
  owners: PropTypes.array,
  stage: PropTypes.string,
  dcsURL: PropTypes.string,
  selectedLanguages: PropTypes.array,
  onFilterChange: PropTypes.func,
  onStatsChange: PropTypes.func,
};

export default DcsCatalogFilter;
