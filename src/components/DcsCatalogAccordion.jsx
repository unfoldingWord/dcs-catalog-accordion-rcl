// React imports
import { useEffect, useState, useCallback, useRef } from 'react';

// Prop Types for type checking in React
import PropTypes from 'prop-types';

// Axios for making HTTP requests
import axios from 'axios';

// Material UI components
import { Accordion, AccordionSummary, AccordionDetails, Tooltip, Typography, CircularProgress } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LanguageIcon from '@mui/icons-material/Language';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import ArticleIcon from '@mui/icons-material/Article';
import YouTubeIcon from '@mui/icons-material/YouTube';
import BookIcon from '@mui/icons-material/Book';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CodeIcon from '@mui/icons-material/Code';
import SourceIcon from '@mui/icons-material/Source';
import PermMediaIcon from '@mui/icons-material/PermMedia';

let allowedDownloadableTypes = ['text', 'audio', 'video', 'other'];

class Format {
  entry = {};
  name = '';
  ext = '';
  format = '';
  quality = '';
  prefix = '';
  version = '';
  asset = null;
  chapters = [];
}

class Chapter extends Format {
  identifier = '';
}

class DownloadableTypes {
  text = [];
  audio = [];
  video = [];
  other = [];
}

function getFileExt(name) {
  return name ? name.split('.').pop() : '';
}

function getFormatFromName(name) {
  if (!name) return '';
  var ext = getFileExt(name.toLowerCase());
  var zip_type_regex = /_(mp3|3gp|mp4)_/gi;
  switch (ext) {
    case '3gp':
      return 'video/3gp';
    case 'html':
      return 'text/html';
    case 'md':
      return 'text/markdown';
    case 'mp3':
      return 'audio/mp3';
    case 'mp4':
      return 'video/mp4';
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/txt';
    case 'usfm':
      return 'text/usfm';
    case 'doc':
      return 'application/doc';
    case 'docx':
      return 'application/docx';
    case 'epub':
      return 'application/epub';
    case 'odt':
      return 'applicaiton/odt';
    case 'zip':
      {
        let match = zip_type_regex.exec(name.toLowerCase());
        if (match) {
          switch (match[1].toLowerCase()) {
            case '3gp':
              return 'application/zip; content=video/3gp';
            case 'mp4':
              return 'application/zip; content=video/mp4';
            case 'mp3':
              return 'application/zip; content=audio/mp3';
          }
        }
      }
      return 'application/zip';
    default:
      if (name.toLowerCase().indexOf('door43.org') > -1) return 'door43.org';
      else if (name.toLowerCase().indexOf('youtube.com') > -1) return 'youtube.com';
      else if (name.toLowerCase().indexOf('bloomlibrary.org') > -1) return 'bloomlibrary.org';
      else if (ext) return ext;
      try {
        return new URL(name).hostname;
      } catch {
        return name;
      }
  }
}

const buildQueryString = (keyedArrays) => {
  if (!keyedArrays) {
    return '';
  }
  const parts = [];
  Object.keys(keyedArrays).forEach((key) => {
    const values = keyedArrays[key];
    if (values) {
      if (Array.isArray(values)) {
        if (values.length) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(values.join(','))}`);
        }
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(values)}`);
      }
    }
  });
  return parts.join('&');
};

function addLinkToDownloadableTypes(downloadable_types, asset, entry) {
  if (!asset || !asset.browser_download_url || !asset.name) return downloadable_types;
  let fmt = new Format();
  fmt.entry = entry;
  fmt.name = asset.name;
  fmt.asset = asset;
  fmt.prefix = new URL(asset.browser_download_url).hostname;
  fmt.format = getFormatFromName(asset.name);
  fmt.version = entry.branch_or_tag_name;
  let type = 'other';

  if (fmt.prefix.indexOf('door43.org') > -1) {
    type = 'text';
  }

  for (let k = 0; k < downloadable_types[type].length; k++) {
    let f = downloadable_types[type][k];
    if (f.prefix == fmt.prefix && f.version > fmt.version) return downloadable_types;
  }
  downloadable_types[type].push(fmt);
  return downloadable_types;
}

function addAssetToDownloadableTypes(downloadable_types, asset, entry) {
  const fileparts_regex = /^([^_]+)_([^_]+)_v([\d.-]+)_*(.*)\.([^._]+)$/;
  const audioparts_regex = /^(\d+|mp\d|3gpp)_([^_]+)$/;
  let fileparts = fileparts_regex.exec(asset.name.toLowerCase());
  if (!fileparts) {
    return addLinkToDownloadableTypes(downloadable_types, asset, entry);
  }
  let prefix = fileparts[1] + '_' + fileparts[2];
  let version = fileparts[3];
  let info = fileparts[4];
  let ext = fileparts[5];
  let format = getFormatFromName(asset.name);
  const audioparts = audioparts_regex.exec(info);
  if (audioparts && (ext == 'zip' || ext == 'mp3' || ext == 'mp4')) {
    let quality = audioparts[2];
    if (ext == 'mp3' || ext == 'mp4') {
      let parent_zip_name = prefix + '_v' + version + '_' + ext + '_' + quality + '.zip';
      let chapterNum = audioparts[1];
      let parent = null;
      let chapter = new Chapter();
      chapter.entry = entry;
      chapter.identifier = chapterNum;
      chapter.name = asset.name;
      chapter.ext = ext;
      chapter.prefix = prefix;
      chapter.version = version;
      chapter.quality = quality;
      chapter.format = format;
      chapter.asset = asset;
      let type = 'audio';
      if (ext == 'mp4') type = 'video';
      for (let k = 0; k < downloadable_types[type].length; k++) {
        let media = downloadable_types[type][k];
        if (media.prefix == prefix && media.quality == quality && media.version > version) return downloadable_types;
        if (!parent && media.name == parent_zip_name) {
          parent = media;
        }
      }
      if (!parent) {
        parent = new Format();
        parent.entry = entry;
        parent.name = parent_zip_name;
        parent.chapters = [];
        parent.quality = quality;
        parent.prefix = prefix;
        parent.ext = 'zip';
        parent.version = version;
        downloadable_types[type].push(parent);
      }
      if (!parent.chapters) {
        parent.chapters = [];
      }
      parent.chapters.push(chapter);
      parent.chapters.sort((a, b) => {
        return a.identifier.localeCompare(b.identifier);
      });
    } else {
      // is a media zip
      let media_ext = audioparts[1];
      let my_fmt;
      let type = 'audio';
      if (media_ext == 'mp4' || media_ext == '3gpp') {
        type = 'video';
      }
      for (let k = 0; k < downloadable_types[type].length; k++) {
        let media = downloadable_types[type][k];
        if (media.prefix == prefix && media.format == format && media.quality == quality && media.version > version) return downloadable_types;
        if (!my_fmt && !media.asset && media.name == asset.name) {
          my_fmt = media;
        }
      }
      if (!my_fmt) {
        my_fmt = new Format();
        my_fmt.entry = entry;
        my_fmt.quality = quality;
        my_fmt.format = format;
        my_fmt.prefix = prefix;
        my_fmt.ext = ext;
        my_fmt.version = version;
        my_fmt.chapters = [];
        downloadable_types[type].push(my_fmt);
      }
      my_fmt.name = asset.name;
      my_fmt.asset = asset;
    }
  } else {
    let fmt = new Format();
    fmt.entry = entry;
    fmt.name = asset.name;
    fmt.prefix = prefix;
    fmt.ext = ext;
    fmt.asset = asset;
    fmt.format = format;
    fmt.version = version;
    let type = 'other';

    if (format.indexOf('audio') > -1) {
      type = 'audio';
    } else if (format.indexOf('video') > -1) {
      type = 'video';
    } else if (
      format.indexOf('markdown') > -1 ||
      format.indexOf('pdf') > -1 ||
      format.indexOf('docx') > -1 ||
      format.indexOf('odt') > -1 ||
      format.indexOf('epub') > -1 ||
      format.indexOf('door43') > -1
    ) {
      type = 'text';
    }

    for (let k = 0; k < downloadable_types[type].length; k++) {
      let f = downloadable_types[type][k];
      if (f.prefix == fmt.prefix && f.ext == fmt.ext && f.format == fmt.format && f.version > fmt.version) return downloadable_types;
    }
    downloadable_types[type].push(fmt);
  }
  return downloadable_types;
}

const LINK_MANIFEST_SUFFIXES = ['links.json', 'link.json', 'assets.json', 'attachments.json', 'files.json'];

function isLinkManifest(name) {
  const lower = name.toLowerCase();
  return LINK_MANIFEST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

async function getDownloadableTypes(entries) {
  let downloadable_types = new DownloadableTypes();

  if (entries.length < 1) return downloadable_types;

  // Fetch all link-manifest assets in parallel, then process every asset in the
  // original order so version de-duplication behaves the same as a serial pass.
  const linkAssetLists = new Map();
  await Promise.all(
    entries.flatMap((entry) =>
      (entry.release?.assets || [])
        .filter((asset) => isLinkManifest(asset.name))
        .map(async (asset) => {
          try {
            const response = await axios.get(asset.browser_download_url);
            linkAssetLists.set(asset, Array.isArray(response.data) ? response.data : [response.data]);
          } catch (error) {
            console.error('Failed to fetch link assets', error);
          }
        })
    )
  );

  for (const entry of entries) {
    for (const asset of entry.release?.assets || []) {
      if (isLinkManifest(asset.name)) {
        (linkAssetLists.get(asset) || []).forEach((linkAsset) => {
          if (linkAsset.browser_download_url) {
            if (!linkAsset.name) {
              linkAsset.name = linkAsset.browser_download_url.substr(linkAsset.browser_download_url.lastIndexOf('/') + 1);
            }
            downloadable_types = addAssetToDownloadableTypes(downloadable_types, linkAsset, entry);
          }
        });
      } else {
        downloadable_types = addAssetToDownloadableTypes(downloadable_types, asset, entry);
      }
    }
  }
  return downloadable_types;
}

function getDescription(fmt, dcsURL = DEFAULT_DCS_URL) {
  let title = fmt.asset.name;

  if (!fmt.format) {
    fmt.format = getFormatFromName(fmt.asset.name);
  }

  let fmt_description = '';
  let IconComponentClass = ArticleIcon;

  let format_parts = fmt.format.split(' ');
  let format_map = {};
  format_parts.forEach((part) => {
    part = part.replace(/\s*;*$/, '');
    let key_value = part.split('=');
    if (key_value.length == 2) {
      format_map[key_value[0]] = key_value[1];
    } else if (!format_map['mime']) {
      format_map['mime'] = part;
    }
  });

  let is_zipped = format_map['mime'] == 'application/zip';
  let mime = format_map['mime'];
  if (is_zipped && 'content' in format_map) {
    mime = format_map['content'];
  }

  let mime_parts = mime.split('/');
  let show_size = true;
  let is_source_regex = new RegExp(`${dcsURL}/[^/]+/[^/]+/archive/`, 'gi');
  switch (mime_parts[mime_parts.length - 1]) {
    case 'pdf':
      fmt_description = 'PDF';
      IconComponentClass = PictureAsPdfIcon;
      break;
    case 'youtube':
      title = fmt.name;
      show_size = false;
      IconComponentClass = YouTubeIcon;
      fmt_description = 'Website';
      break;
    case 'bloom':
      title = fmt.name;
      show_size = false;
      fmt_description = 'Website';
      IconComponentClass = BookIcon;
      break;
    case 'door43.org':
      title = fmt.name;
      fmt_description = 'Website';
      IconComponentClass = LanguageIcon;
      show_size = false;
      break;
    case new URL(dcsURL).hostname:
      title = fmt.name;
      fmt_description = 'Source Files';
      IconComponentClass = FolderZipIcon;
      show_size = false;
      break;
    case 'docx':
      fmt_description = 'Word Document';
      break;
    case 'odt':
      fmt_description = 'OpenDocument Text';
      break;
    case 'epub':
      fmt_description = 'ePub Book';
      IconComponentClass = AutoStoriesIcon;
      break;
    case 'markdown':
    case 'md':
      fmt_description = 'Markdown';
      IconComponentClass = SourceIcon;
      break;
    case 'html':
      fmt_description = 'HTML';
      IconComponentClass = CodeIcon;
      break;
    case 'usfm':
      fmt_description = 'USFM';
      IconComponentClass = SourceIcon;
      break;
    case 'mp3':
      fmt_description = 'MP3';
      IconComponentClass = AudioFileIcon;
      break;
    case 'mp4':
      fmt_description = 'MP4';
      IconComponentClass = VideoFileIcon;
      break;
    case '3gp':
    case '3gpp':
      fmt_description = '3GP';
      IconComponentClass = VideoFileIcon;
      break;
    case 'zip':
      {
        IconComponentClass = FolderZipIcon;
        fmt_description = 'Zipped';
        let match = is_source_regex.exec(fmt.asset.browser_download_url);
        if (match) {
          fmt_description += ', Source Files';
        }
      }
      break;
    default:
      title = fmt.name;
      fmt_description = fmt.format;
      break;
  }

  if (fmt.quality && fmt.quality != fmt_description) {
    fmt_description += '; ' + fmt.quality;
  }

  let size_string = '';
  if (show_size && fmt.asset.size > 0) {
    size_string = getSize(fmt.asset.size);
    if (is_zipped) {
      size_string += ' zipped';
    }
  }

  if (size_string) {
    size_string = '; ' + size_string;
  }

  let TitleComponent = <>{title}</>
  if ('identifier' in fmt) {
    TitleComponent = <><span style={{ color: "#606060"}}>Chapter {parseInt(fmt.identifier).toLocaleString()}:</span> {title}</>;
  }

  return (
    <>
      <IconComponentClass style={{ marginRight: '8px' }} />
      {TitleComponent}
      <span style={{ color: "#606060", marginLeft: "10px" }}>({fmt_description}{size_string})</span>
    </>
  );
}

function getSize(file_size) {
  if (file_size === 0) {
    return '';
  }

  if (file_size < 1000) {
    return file_size.toLocaleString() + ' Bytes';
  }

  let kb = file_size / 1024;
  if (kb < 1000) {
    return kb.toFixed(1).toLocaleString() + ' KB';
  }

  let mb = kb / 1024;
  if (mb < 1000) {
    return mb.toFixed(1).toLocaleString() + ' MB';
  }

  let gb = mb / 1024;
  if (gb < 1000) {
    return gb.toFixed(1).toLocaleString() + ' GB';
  }

  return 'UNKNOWN';
}

// Renders one downloadable-type list (text/audio/video/other) with the per-chapter
// expander; shared by the version cards and the resource card's latest audio/video.
function DownloadableFormatList({ formats, dcsURL }) {
  return (
    <ul style={{ listStyle: 'none', margin: '4px 0', padding: '0 0 0 10px', lineHeight: 1.9 }}>
      {formats.map((format) => (
        <li key={format.asset?.browser_download_url || format.name}>
          <a
            href={format.asset.browser_download_url}
            style={{ textDecoration: 'none' }}
            target="_blank"
            rel="noreferrer noopener"
          >{getDescription(format, dcsURL)}</a>
          {format.chapters?.length > 0 ? (
            <Tooltip title="Download individual chapters" arrow>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  const ulElement = e.target.nextElementSibling;
                  if (ulElement) {
                    ulElement.style.display = ulElement.style.display === 'none' ? 'block' : 'none';
                    e.target.textContent = ulElement.style.display === 'none' ? 'Show chapters' : 'Hide chapters';
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1976d2',
                  cursor: 'pointer',
                  fontSize: '0.85em',
                  marginLeft: '0.5rem',
                  padding: 0,
                }}
              >Show chapters</button>
            </Tooltip>) : null}
          {format.chapters?.length > 0 ? (<ul style={{ display: 'none', listStyle: 'none', padding: '0 0 0 20px' }}>
            {format.chapters.map((chapter) => (
            <li key={chapter.asset?.browser_download_url || chapter.name}>
              <a
              href={chapter.asset.browser_download_url}
              style={{ textDecoration: 'none' }}
              target="_blank"
              rel="noreferrer noopener">
              {chapter.name.toLowerCase().endsWith('.mp4') ? <VideoFileIcon style={{ marginRight: '0.5rem', fontSize: '1em' }} /> : <AudioFileIcon style={{ marginRight: '0.5rem', fontSize: '1em' }} />}
              {chapter.name}
              </a>
            </li>))}
          </ul>) : ''}
        </li>
      ))}
    </ul>
  );
}

DownloadableFormatList.propTypes = {
  formats: PropTypes.array.isRequired,
  dcsURL: PropTypes.string,
};

const DEFAULT_DCS_URL = 'https://git.door43.org';
const API_PATH = 'api/v1';
const DEFAULT_STAGE = 'prod';

// Unmount collapsed accordion details so ~200 collapsed languages don't keep their
// subtrees (and loading spinners) mounted in the DOM.
const ACCORDION_SLOT_PROPS = { transition: { unmountOnExit: true } };

const DcsCatalogAccordion = ({ subjects, owners, languages, stage, dcsURL = DEFAULT_DCS_URL }) => {
  const [languagesData, setLanguagesData] = useState({});
  const [ownersData, setOwnersData] = useState({});
  const [topCatalogEntriesData, setTopCatalogEntriesData] = useState({});
  const [accordionMap, setAccordionMap] = useState();
  // Single source of truth for which accordions are open; every Accordion is controlled.
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  // The deep-link target lives in a ref so event handlers always see the current value;
  // the state mirror exists to trigger the effects below when the target is set or cleared.
  const accordionIdToShowRef = useRef(window.location.hash?.substring(1) || '');
  const [accordionIdToShow, setAccordionIdToShow] = useState(accordionIdToShowRef.current);
  const fetchesInFlightRef = useRef(new Set());

  const handleAccordionToggle = useCallback((id, expanded) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    if (expanded && !accordionIdToShowRef.current) {
      window.history.pushState(null, null, `#${id}`);
    }
  }, []);

  // Fetches whatever an expanded level still needs, as soon as it is expanded. Deep
  // links work by pre-expanding every level of the target id: each fetch fills in
  // accordionMap, which re-runs this effect to fetch the next level down. No level is
  // ever fetched twice (fetchesInFlightRef guards in-flight requests; accordionMap
  // records completed ones).
  useEffect(() => {
    if (!accordionMap) {
      return;
    }

    const startFetch = (key, fetcher) => {
      if (fetchesInFlightRef.current.has(key)) {
        return;
      }
      fetchesInFlightRef.current.add(key);
      fetcher().finally(() => fetchesInFlightRef.current.delete(key));
    };

    const fetchOwners = async (lc) => {
      try {
        const response = await axios.get(
          `${dcsURL}/${API_PATH}/catalog/list/owners?${buildQueryString({ subject: subjects, lang: [lc.toLowerCase()], owner: owners, stage: [stage || DEFAULT_STAGE] })}`
        );
        const newOwnersData = {};
        const accordionMapOwnerMap = {};
        (response.data.data || []).forEach((info) => {
          newOwnersData[info.username] = info;
          accordionMapOwnerMap[info.username] = null;
        });
        setOwnersData((prevState) => ({
          ...prevState,
          ...newOwnersData,
        }));
        setAccordionMap((prevState) => ({
          ...prevState,
          [lc]: accordionMapOwnerMap,
        }));
      } catch (error) {
        console.error('Failed to fetch owners', error);
      }
    };

    const fetchTopCatalogEntries = async (lc, username) => {
      try {
        const response = await axios.get(`${dcsURL}/${API_PATH}/catalog/search?${buildQueryString({ subject: subjects, lang: [lc.toLowerCase()], owner: [username], stage: stage, sort: "title", order: "asc" })}`);
        const accordionMapOwnerTopCatalogEntriesMap = {};
        const newTopCatalogEntriesMap = {};
        (response.data.data || []).forEach((info) => {
          newTopCatalogEntriesMap[info.full_name] = info;
          accordionMapOwnerTopCatalogEntriesMap[info.name] = null;
        });
        setTopCatalogEntriesData((prevState) => ({
          ...prevState,
          ...newTopCatalogEntriesMap,
        }));
        setAccordionMap((prevState) => ({
          ...prevState,
          [lc]: {
            ...prevState[lc],
            [username]: accordionMapOwnerTopCatalogEntriesMap,
          },
        }));
      } catch (error) {
        console.error('Failed to fetch entries', error);
      }
    };

    const fetchCatalogEntriesWithDownloadables = async (lc, username, reponame, topCatalogEntry) => {
      try {
        const response = await axios.get(
          `${dcsURL}/${API_PATH}/catalog/search?owner=${encodeURIComponent(topCatalogEntry.owner)}&repo=${encodeURIComponent(
            topCatalogEntry.name
          )}&includeHistory=1&sort=released&order=desc&stage=${stage || 'prod'}`
        );
        const otherVersionsWithAssets = [];
        let extensionsToIgnore = [];
        (response.data.data || []).forEach((entry) => {
          if (entry.release?.assets?.filter(asset => !extensionsToIgnore.includes(getFileExt(asset.browser_download_url)))?.length > 0) {
            otherVersionsWithAssets.push(entry);
            const myExtensionTypes = entry.release.assets.map(asset => getFileExt(asset.browser_download_url)).filter(ext => ext.trim());
            extensionsToIgnore = [...extensionsToIgnore, ...myExtensionTypes]
          }
        });
        await Promise.all(
          otherVersionsWithAssets.map(async (entry) => {
            entry.downloadableTypes = await getDownloadableTypes([entry]);
          })
        );
        setAccordionMap((prevState) => ({
          ...prevState,
          [lc]: {
            ...prevState[lc],
            [username]: {
              ...prevState[lc][username],
              [reponame]: otherVersionsWithAssets,
            },
          },
        }));
      } catch (error) {
        console.error('Failed to fetch entries', error);
      }
    };

    expandedIds.forEach((id) => {
      const parts = id.split('--');
      const [lc, username, reponame] = parts;
      if (parts.length === 1 && lc in accordionMap && !accordionMap[lc]) {
        startFetch(id, () => fetchOwners(lc));
      } else if (parts.length === 2 && accordionMap[lc] && username in accordionMap[lc] && !accordionMap[lc][username]) {
        startFetch(id, () => fetchTopCatalogEntries(lc, username));
      } else if (parts.length === 3 && accordionMap[lc]?.[username] && reponame in accordionMap[lc][username] && !accordionMap[lc][username][reponame]) {
        const topCatalogEntry = topCatalogEntriesData[`${username}/${reponame}`];
        if (topCatalogEntry) {
          startFetch(id, () => fetchCatalogEntriesWithDownloadables(lc, username, reponame, topCatalogEntry));
        }
      }
    });
  }, [expandedIds, accordionMap, topCatalogEntriesData, dcsURL, subjects, owners, stage]);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await axios.get(`${dcsURL}/${API_PATH}/catalog/list/languages?${buildQueryString({ owner: owners, subject: subjects, stage: [stage || DEFAULT_STAGE] })}`);
        const langData = {};
        const accMap = {};
        (response.data.data || []).forEach((info) => {
          if (!languages?.length || languages?.includes(info.lc)) {
            langData[info.lc] = info;
            accMap[info.lc] = null;
          }
        });
        setLanguagesData(langData);
        setAccordionMap(accMap);
      } catch (error) {
        console.log('Error fetching languages', error);
        setAccordionMap({});
      }
    };

    setExpandedIds(new Set());
    fetchLanguages();
  }, [dcsURL, languages, subjects, owners, stage]);

  useEffect(() => {
    const handleHashChange = () => {
      accordionIdToShowRef.current = window.location.hash?.substring(1) || '';
      setAccordionIdToShow(accordionIdToShowRef.current);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Deep linking: pre-expands every level of the target id up front (the fetch effect
  // above loads each level's data as it opens), then scrolls to the deepest level that
  // exists and clears the target once it is open or the fetched data shows it doesn't
  // exist. No DOM clicking — expansion is plain state.
  useEffect(() => {
    const handleAccordionsNeedingExpanding = () => {
      const idsToExpand = Array.from(document.querySelectorAll('.needs-expanding'))
        .map((accordion) => accordion.id)
        .filter(Boolean);
      if (idsToExpand.length) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          idsToExpand.forEach((id) => next.add(id));
          return next.size !== prev.size ? next : prev;
        });
      }
    };

    if (!accordionIdToShow) {
      handleAccordionsNeedingExpanding();
      return;
    }
    if (!accordionMap) {
      return;
    }

    const [lang, username, reponame, version] = accordionIdToShow.split('--');
    const targetIds = [
      lang,
      username && `${lang}--${username}`,
      reponame && `${lang}--${username}--${reponame}`,
      version && `${lang}--${username}--${reponame}--${version}`,
    ].filter(Boolean);

    setExpandedIds((prev) => {
      if (targetIds.every((id) => prev.has(id))) {
        return prev;
      }
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(id));
      return next;
    });

    const finish = () => {
      for (let i = targetIds.length - 1; i >= 0; i--) {
        const accordion = document.getElementById(targetIds[i]);
        if (accordion) {
          accordion.scrollIntoView();
          break;
        }
      }
      accordionIdToShowRef.current = '';
      setAccordionIdToShow('');
    };

    if (!(lang in accordionMap)) {
      finish();
      return;
    }
    if (!username) {
      finish();
      return;
    }
    if (!accordionMap[lang]) {
      return; // owners still being fetched
    }
    if (!(username in accordionMap[lang])) {
      finish();
      return;
    }
    if (!reponame) {
      finish();
      return;
    }
    if (!accordionMap[lang][username]) {
      return; // repos still being fetched
    }
    if (!(reponame in accordionMap[lang][username])) {
      finish();
      return;
    }
    if (!version) {
      finish();
      return;
    }
    if (!accordionMap[lang][username][reponame]) {
      return; // versions still being fetched
    }
    finish(); // version accordion is expanded via expandedIds, or absent from the data
  }, [accordionIdToShow, accordionMap, topCatalogEntriesData]);

  const accordionStyles = {
    border: '1px solid #d8dee4',
    borderRadius: '8px',
    marginBottom: '8px',
    boxShadow: 'none',
    overflow: 'hidden',
    '&:before': {
      display: 'none',
    },
  };

  const accordionSummaryStyles = {
    '&:hover:not(.Mui-expanded)': {
      backgroundColor: '#f0f4f8',
    },
    '&.Mui-expanded': {
      backgroundColor: '#416a8b',
      color: 'white',
      '& a': {
        color: 'lightgrey',
      },
    },
    '.MuiAccordionSummary-content': {
      margin: "12px 0px !important",
    }
  };

  return (
    <div style={{ fontFamily: 'Roboto, Helvetica, Arial, sans-serif', color: '#1f2328' }}>
      {Object.keys(accordionMap || {}).length ? (
        Object.keys(accordionMap)?.map((lc) => (
          <Accordion
            sx={accordionStyles}
            disableGutters
            id={lc}
            key={lc}
            expanded={expandedIds.has(lc)}
            onChange={(event, expanded) => handleAccordionToggle(lc, expanded)}
            slotProps={ACCORDION_SLOT_PROPS}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummaryStyles}>
              <Tooltip title={lc} arrow>
                <Typography style={{ fontWeight: 'bold' }}>
                  {lc}{' '}
                  {languagesData?.[lc] && (
                    <>
                      / <span style={{ direction: languagesData[lc].ld || 'ltr' }}>{languagesData[lc].ln}</span> / {languagesData[lc].ang}
                    </>
                  )}
                </Typography>
              </Tooltip>
            </AccordionSummary>
            <AccordionDetails>
              {Object.keys(accordionMap[lc] || {}).length ? (
                Object.keys(accordionMap[lc] || {})?.map((username) => (
                  <Accordion
                    sx={accordionStyles}
                    disableGutters
                    id={`${lc}--${username}`}
                    key={username}
                    expanded={expandedIds.has(`${lc}--${username}`)}
                    onChange={(event, expanded) => handleAccordionToggle(`${lc}--${username}`, expanded)}
                    slotProps={ACCORDION_SLOT_PROPS}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummaryStyles}>
                      <Tooltip title={username} arrow>
                        <Typography style={{ fontWeight: 'bold' }}>
                          Published by: {ownersData?.[username]?.full_name ? `${ownersData[username].full_name}` + (ownersData[username].full_name.toLowerCase().replace(/[^a-z0-9_.-]/g, '') != username.toLowerCase() ? ` (${username})` : '') : username}
                            <a
                              href={`https://git.door43.org/${username}`}
                              target="_blank"
                              rel="noopener noreferrer"

                            >
                              <OpenInNewIcon style={{fontSize: '1.2em', marginLeft: '10px', padding: '0', color: 'inherit'}} />
                            </a>
                        </Typography>
                      </Tooltip>
                    </AccordionSummary>
                    <AccordionDetails>
                      {Object.keys(accordionMap[lc][username] || {}).length ? (
                        Object.keys(accordionMap[lc][username] || {})?.map((reponame) => {
                          const id = `${username}/${reponame}`;
                          const topEntry = topCatalogEntriesData[id];
                          const topEntryPDFs = topEntry?.release?.assets?.filter(asset => asset.name.endsWith(".pdf"));
                          let topEntryPDF = null;
                          if (topEntryPDFs?.length == 1) {
                            topEntryPDF = topEntryPDFs[0];
                          }
                          // Surface the newest version's PDF/audio/video on the resource card so
                          // users don't have to dig through version accordions to find them.
                          const versionEntries = accordionMap[lc][username][reponame];
                          if (!topEntryPDF && Array.isArray(versionEntries)) {
                            const entryWithPDF = versionEntries.find((e) => e.downloadableTypes?.text?.some((f) => f.format === 'application/pdf'));
                            const pdfFormats = entryWithPDF?.downloadableTypes?.text?.filter((f) => f.format === 'application/pdf');
                            if (pdfFormats?.length === 1) {
                              topEntryPDF = pdfFormats[0].asset;
                            }
                          }
                          const latestAudioEntry = Array.isArray(versionEntries) ? versionEntries.find((e) => e.downloadableTypes?.audio?.length) : null;
                          const latestVideoEntry = Array.isArray(versionEntries) ? versionEntries.find((e) => e.downloadableTypes?.video?.length) : null;
                          return (
                            <Accordion
                              sx={accordionStyles}
                              disableGutters
                              id={`${lc}--${username}--${reponame}`}
                              key={id}
                              expanded={expandedIds.has(`${lc}--${username}--${reponame}`)}
                              onChange={(event, expanded) => handleAccordionToggle(`${lc}--${username}--${reponame}`, expanded)}
                              slotProps={ACCORDION_SLOT_PROPS}
                            >
                              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummaryStyles}>
                                <Tooltip title={topEntry.subject} arrow>
                                  <div style={{ width: '100%', alignItems: 'center' }}>
                                    <Typography style={{ fontWeight: 'bold' }}>{topEntry.title} ({topEntry.branch_or_tag_name})</Typography>
                                  </div>
                                </Tooltip>
                              </AccordionSummary>
                              <AccordionDetails>
                                <ul id="downloadable-links" key="links" style={{ listStyle: "none", margin: '4px 0', padding: '0 0 0 10px', lineHeight: 1.9 }}>
                                  {topEntryPDF ?
                                  <li key="pdf">
                                    <a
                                      href={topEntryPDF.browser_download_url}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
                                    <PictureAsPdfIcon style={{ marginRight: '0.5rem', fontSize: '1em',  }} />
                                      {topEntryPDF.name} (Latest PDF)
                                    </a>
                                  </li>
                                  : null}
                                  <li key="preview">
                                    <a
                                      href={`https://preview.door43.org/u/${topCatalogEntriesData[id].full_name}/${topCatalogEntriesData[id].branch_or_tag_name}`}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
                                    <PictureAsPdfIcon style={{ marginRight: '0.5rem', fontSize: '1em',  }} />
                                    Preview / PDF (Website)
                                    </a>
                                  </li>
                                  <li key="dcs">
                                    <a
                                      href={`${dcsURL}/${topCatalogEntriesData[id].full_name}/src/${topCatalogEntriesData[id].ref_type}/${topCatalogEntriesData[id].branch_or_tag_name}`}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
                                      <LanguageIcon style={{ marginRight: '0.5rem', fontSize: '1em',  }} />
                                      View on DCS (Website)
                                    </a>
                                  </li>
                                  <li key="source">
                                    <a
                                      href={`${dcsURL}/${topCatalogEntriesData[id].full_name}/archive/${topCatalogEntriesData[id].branch_or_tag_name}.zip`}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
                                      <FolderZipIcon style={{ marginRight: '0.5rem', fontSize: '1em',  }} />
                                      Source Files (Zipped)
                                    </a>
                                  </li>
                                  {topEntry.metadata_type === "rc" && (
                                  <li key="sb">
                                    <a
                                      href={`${dcsURL}/${topCatalogEntriesData[id].full_name}/sb/${topCatalogEntriesData[id].branch_or_tag_name}.zip`}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
                                      <FolderZipIcon style={{ marginRight: '0.5rem', fontSize: '1em',  }} />
                                      Source Files as Scripture Burrito (Zipped)
                                    </a>
                                  </li>
                                  )}
                                </ul>
                                {latestAudioEntry ? (
                                  <div style={{ paddingLeft: '10px' }} key="latest-audio">
                                    <h4 style={{ margin: '10px 0 0' }}>
                                      Audio <span style={{ fontWeight: 'normal', color: '#656d76' }}>({latestAudioEntry.branch_or_tag_name})</span>
                                    </h4>
                                    <DownloadableFormatList formats={latestAudioEntry.downloadableTypes.audio} dcsURL={dcsURL} />
                                  </div>
                                ) : null}
                                {latestVideoEntry ? (
                                  <div style={{ paddingLeft: '10px' }} key="latest-video">
                                    <h4 style={{ margin: '10px 0 0' }}>
                                      Video <span style={{ fontWeight: 'normal', color: '#656d76' }}>({latestVideoEntry.branch_or_tag_name})</span>
                                    </h4>
                                    <DownloadableFormatList formats={latestVideoEntry.downloadableTypes.video} dcsURL={dcsURL} />
                                  </div>
                                ) : null}
                                {accordionMap[lc][username][reponame]?.length ? (
                                  <div style={{ paddingLeft: '10px' }} key="downloadables">
                                    <h4 style={{ margin: '10px 0 4px' }}>All Versions:</h4>
                                    {accordionMap[lc][username][reponame]?.map((entry) => (
                                      <Accordion
                                        sx={accordionStyles}
                                        disableGutters
                                        id={`${lc}--${username}--${reponame}--${entry.branch_or_tag_name}`}
                                        key={entry.branch_or_tag_name}
                                        expanded={expandedIds.has(`${lc}--${username}--${reponame}--${entry.branch_or_tag_name}`)}
                                        onChange={(event, expanded) => handleAccordionToggle(`${lc}--${username}--${reponame}--${entry.branch_or_tag_name}`, expanded)}
                                        slotProps={ACCORDION_SLOT_PROPS}
                                      >
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummaryStyles}>
                                          <Tooltip title={entry.release?.name} arrow>
                                            <Typography><PermMediaIcon style={{ verticalAlign: 'middle'  }} /> {entry.branch_or_tag_name}</Typography>
                                          </Tooltip>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                          {allowedDownloadableTypes.map((type) => {
                                            if (!(type in entry.downloadableTypes) || !entry.downloadableTypes[type].length) {
                                              return null;
                                            }
                                            return (
                                              <div key={type} style={{ paddingLeft: '10px' }}>
                                                <div><strong><em>{type.charAt(0).toUpperCase() + type.slice(1)}</em></strong></div>
                                                <DownloadableFormatList formats={entry.downloadableTypes[type]} dcsURL={dcsURL} />
                                              </div>
                                            );
                                          })}
                                        </AccordionDetails>
                                      </Accordion>
                                    ))}
                                  </div>
                                ) : (
                                  ''
                                )}
                              </AccordionDetails>
                            </Accordion>
                          );
                        })
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                          <CircularProgress />
                        </div>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </div>
              )}
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </div>
      )}
    </div>
  );
};

DcsCatalogAccordion.propTypes = {
  languages: PropTypes.array,
  owners: PropTypes.array,
  subjects: PropTypes.array,
  stage: PropTypes.string,
  dcsURL: PropTypes.string,
};

export default DcsCatalogAccordion;
