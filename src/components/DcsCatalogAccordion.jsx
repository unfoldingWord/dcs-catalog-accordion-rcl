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

import { API_PATH, DEFAULT_DCS_URL, DEFAULT_STAGE, buildQueryString, mediaTypeParams } from '../lib/dcsApi';

let allowedDownloadableTypes = ['text', 'audio', 'video', 'other'];

// Media extensions recognized as audio/video. These tables drive the download-section
// typing, the chapter grouping, zip content detection, description labels and icons —
// add new media formats here, not in the switch statements below.
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'wav', 'wma'];
const VIDEO_EXTENSIONS = ['mp4', 'm4v', '3gp', '3gpp', 'webm', 'mkv', 'mov', 'avi', 'wmv'];
const MEDIA_EXTENSIONS = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];

function mediaMimeFromExt(ext) {
  const normalized = ext === '3gpp' ? '3gp' : ext;
  if (AUDIO_EXTENSIONS.includes(ext)) return `audio/${normalized}`;
  if (VIDEO_EXTENSIONS.includes(ext)) return `video/${normalized}`;
  return '';
}

function isVideoFileName(name) {
  return VIDEO_EXTENSIONS.includes(getFileExt((name || '').toLowerCase()));
}

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
  var zip_type_regex = new RegExp(`_(${MEDIA_EXTENSIONS.join('|')})_`, 'i');
  const mediaMime = mediaMimeFromExt(ext);
  if (mediaMime) {
    return mediaMime;
  }
  switch (ext) {
    case 'html':
      return 'text/html';
    case 'md':
      return 'text/markdown';
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
          const zippedMime = mediaMimeFromExt(match[1].toLowerCase());
          if (zippedMime) {
            return `application/zip; content=${zippedMime}`;
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
  const audioparts_regex = new RegExp(`^(\\d+|${MEDIA_EXTENSIONS.join('|')})_([^_]+)$`);
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
  if (audioparts && (ext == 'zip' || MEDIA_EXTENSIONS.includes(ext))) {
    let quality = audioparts[2];
    if (MEDIA_EXTENSIONS.includes(ext)) {
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
      let type = VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'audio';
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
      let type = VIDEO_EXTENSIONS.includes(media_ext) ? 'video' : 'audio';
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

// Merges each downloadable type across version entries (which are sorted newest
// first): an older version's format is only included when no newer version supplied a
// format with the same prefix/extension/quality, so e.g. OBS v8's docx/epub/odt still
// surface alongside v9's PDF, but v8's own PDF is superseded. Within a single version
// nothing is dropped. Returns null while versionEntries is still loading.
function getLatestDownloadableTypes(versionEntries) {
  if (!Array.isArray(versionEntries)) return null;
  const merged = new DownloadableTypes();
  const seen = {};
  allowedDownloadableTypes.forEach((type) => {
    seen[type] = new Set();
  });
  versionEntries.forEach((entry) => {
    allowedDownloadableTypes.forEach((type) => {
      const entrySignatures = [];
      (entry.downloadableTypes?.[type] || []).forEach((fmt) => {
        const signature = `${fmt.prefix}|${getFileExt(fmt.name)}|${fmt.quality}`;
        if (!seen[type].has(signature)) {
          merged[type].push(fmt);
          entrySignatures.push(signature);
        }
      });
      entrySignatures.forEach((signature) => seen[type].add(signature));
    });
  });
  return merged;
}

// Generic PDF file icon: page outline with a red PDF label. Deliberately generic —
// Adobe's official PDF icon is trademarked and unsuitable for an MIT-licensed library.
function PdfFileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '1.2em', height: '1.2em', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}>
      <path d="M6 1.5h9l5 5v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-20a1 1 0 0 1 1-1z" fill="#fff" stroke="#8a939e" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M15 1.5v5h5" fill="none" stroke="#8a939e" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="3" y="10.5" width="18" height="8.5" rx="1.5" fill="#FA0F00" />
      <text x="12" y="17.1" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" fontSize="7" fill="#fff">PDF</text>
    </svg>
  );
}

// Picks the PDF to surface on the resource card's main links: a single PDF is
// unambiguous; among several, only the canonical <repo>_<tag>.pdf (e.g.
// en_obs-sn_v5.pdf) is surfaced — combined/companion PDFs (en_obs-sn-sq_v5-v3.pdf)
// stay in the Text Downloads section.
function pickSurfacePDF(pdfAssets, entry) {
  if (!pdfAssets?.length) {
    return null;
  }
  if (pdfAssets.length === 1) {
    return pdfAssets[0];
  }
  const canonicalName = `${entry.name}_${entry.branch_or_tag_name}.pdf`.toLowerCase();
  return pdfAssets.find((asset) => asset.name.toLowerCase() === canonicalName) || null;
}

// Repo source zips (git archive and Scripture Burrito) belong under Other Downloads
// rather than the resource card's main links; they matter less than PDF/YouTube/preview.
function appendSourceZipFormats(otherFormats, topEntry, dcsURL) {
  const branch = topEntry.branch_or_tag_name;
  const pushZip = (name, url) => {
    otherFormats.push({
      entry: topEntry,
      name,
      ext: 'zip',
      format: new URL(dcsURL).hostname,
      quality: '',
      prefix: '',
      version: branch,
      chapters: [],
      asset: { name, browser_download_url: url, size: 0 },
    });
  };
  pushZip(`${topEntry.name}-${branch}.zip`, `${dcsURL}/${topEntry.full_name}/archive/${branch}.zip`);
  if (topEntry.metadata_type !== 'sb') {
    pushZip(`${topEntry.name}-${branch}-scripture-burrito.zip`, `${dcsURL}/${topEntry.full_name}/sb/${branch}.zip`);
  }
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
  const media_ext = mime_parts[mime_parts.length - 1];
  if (AUDIO_EXTENSIONS.includes(media_ext) || VIDEO_EXTENSIONS.includes(media_ext)) {
    fmt_description = media_ext.toUpperCase();
    IconComponentClass = AUDIO_EXTENSIONS.includes(media_ext) ? AudioFileIcon : VideoFileIcon;
  } else switch (mime_parts[mime_parts.length - 1]) {
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
          {format.asset ? (
            <a
              href={format.asset.browser_download_url}
              style={{ textDecoration: 'none' }}
              target="_blank"
              rel="noreferrer noopener"
            >{getDescription(format, dcsURL)}</a>
          ) : (
            // Chapter files uploaded without an accompanying zip: there is no parent
            // download, but the chapter group still needs its header row.
            <span>
              {isVideoFileName(format.chapters?.[0]?.name) ? <VideoFileIcon style={{ marginRight: '8px' }} /> : <AudioFileIcon style={{ marginRight: '8px' }} />}
              {format.name.replace(/\.zip$/i, '')}
              <span style={{ color: '#606060', marginLeft: '10px' }}>
                ({getFileExt(format.chapters?.[0]?.name || '').toUpperCase()}{format.quality ? `; ${format.quality}` : ''}; {(format.chapters?.length || 0).toLocaleString()} chapters)
              </span>
            </span>
          )}
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
              {isVideoFileName(chapter.name) ? <VideoFileIcon style={{ marginRight: '0.5rem', fontSize: '1em' }} /> : <AudioFileIcon style={{ marginRight: '0.5rem', fontSize: '1em' }} />}
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

// Unmount collapsed accordion details so ~200 collapsed languages don't keep their
// subtrees (and loading spinners) mounted in the DOM.
const ACCORDION_SLOT_PROPS = { transition: { unmountOnExit: true } };

const DOWNLOAD_TYPE_ICONS = {
  text: ArticleIcon,
  audio: AudioFileIcon,
  video: VideoFileIcon,
  other: PermMediaIcon,
};

const DcsCatalogAccordion = ({ subjects, owners, languages, mediaTypes, stage, dcsURL = DEFAULT_DCS_URL }) => {
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
          `${dcsURL}/${API_PATH}/catalog/list/owners?${buildQueryString({ subject: subjects, lang: [lc.toLowerCase()], owner: owners, stage: [stage || DEFAULT_STAGE], ...mediaTypeParams(mediaTypes) })}`
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
        const query = buildQueryString({ subject: subjects, lang: [lc.toLowerCase()], owner: [username], stage: stage, sort: 'title', order: 'asc', ...mediaTypeParams(mediaTypes) });
        const response = await axios.get(`${dcsURL}/${API_PATH}/catalog/search?${query}`);
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
        // The one intentional includeHistory use in this library: this per-repo query
        // gathers every release so the download sections can offer each release's
        // PDFs/audio/video/stream/other assets. Never send includeHistory to stats-ext
        // or the list endpoints — it inflates counts with superseded releases.
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
  }, [expandedIds, accordionMap, topCatalogEntriesData, dcsURL, subjects, owners, stage, mediaTypes]);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await axios.get(`${dcsURL}/${API_PATH}/catalog/list/languages?${buildQueryString({ owner: owners, subject: subjects, stage: [stage || DEFAULT_STAGE], ...mediaTypeParams(mediaTypes) })}`);
        const langData = {};
        const accMap = {};
        // Case-insensitive membership test: callers (e.g. DcsCatalogFilter, stats-ext
        // results) may supply codes in a different casing than the canonical lc.
        const languagesLower = (languages || []).map((lang) => lang.toLowerCase());
        (response.data.data || []).forEach((info) => {
          if (!languagesLower.length || languagesLower.includes(info.lc.toLowerCase())) {
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
  }, [dcsURL, languages, subjects, owners, stage, mediaTypes]);

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
                          const topEntryPDFs = topEntry?.release?.assets?.filter(asset => asset.name.toLowerCase().endsWith(".pdf"));
                          let topEntryPDF = topEntry ? pickSurfacePDF(topEntryPDFs, topEntry) : null;
                          // Surface the newest version's PDF/audio/video on the resource card so
                          // users don't have to dig through version accordions to find them.
                          const versionEntries = accordionMap[lc][username][reponame];
                          if (!topEntryPDF && Array.isArray(versionEntries)) {
                            const entryWithPDF = versionEntries.find((e) => e.downloadableTypes?.text?.some((f) => f.format === 'application/pdf'));
                            const pdfFormats = entryWithPDF?.downloadableTypes?.text?.filter((f) => f.format === 'application/pdf');
                            if (pdfFormats?.length) {
                              topEntryPDF = pickSurfacePDF(pdfFormats.map((format) => format.asset), entryWithPDF);
                            }
                          }
                          const latestDownloadableTypes = getLatestDownloadableTypes(versionEntries);
                          // A YouTube link stays in Other Downloads but is also promoted to the
                          // main links so users can't miss that a video version exists.
                          const latestYouTube = latestDownloadableTypes?.other?.find((fmt) => {
                            const url = fmt.asset?.browser_download_url?.toLowerCase() || '';
                            return fmt.format?.toLowerCase().includes('youtube') || url.includes('youtube.com') || url.includes('youtu.be');
                          });
                          if (latestDownloadableTypes && topEntry) {
                            appendSourceZipFormats(latestDownloadableTypes.other, topEntry, dcsURL);
                          }
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
                                    <PdfFileIcon />
                                      {topEntryPDF.name} (PDF)
                                    </a>
                                  </li>
                                  : null}
                                  {latestYouTube ?
                                  <li key="youtube">
                                    <a
                                      href={latestYouTube.asset.browser_download_url}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
                                    <YouTubeIcon style={{ marginRight: '0.5rem', fontSize: '1.2em', verticalAlign: 'text-bottom', color: '#FF0000' }} />
                                      Watch on YouTube (Website)
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
                                    <img src="https://preview.door43.org/favicon.ico" alt="" style={{ width: '1.1em', height: '1.1em', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
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
                                      <img src={`${dcsURL}/assets/img/favicon.png`} alt="" style={{ width: '1.1em', height: '1.1em', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                                      View on DCS (Website)
                                    </a>
                                  </li>
                                </ul>
                                {latestDownloadableTypes ? (
                                  allowedDownloadableTypes.map((type) => {
                                    const formats = latestDownloadableTypes[type];
                                    if (!formats?.length) {
                                      return null;
                                    }
                                    const sectionId = `${lc}--${username}--${reponame}--${type}`;
                                    const SectionIcon = DOWNLOAD_TYPE_ICONS[type];
                                    return (
                                      <Accordion
                                        sx={accordionStyles}
                                        disableGutters
                                        id={sectionId}
                                        key={type}
                                        expanded={expandedIds.has(sectionId)}
                                        onChange={(event, expanded) => handleAccordionToggle(sectionId, expanded)}
                                        slotProps={ACCORDION_SLOT_PROPS}
                                      >
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummaryStyles}>
                                          <Typography style={{ fontWeight: 'bold' }}>
                                            <SectionIcon style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                            {type.charAt(0).toUpperCase() + type.slice(1)} Downloads
                                            <span style={{ fontWeight: 'normal', opacity: 0.7 }}> ({formats.length})</span>
                                          </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                          <DownloadableFormatList formats={formats} dcsURL={dcsURL} />
                                        </AccordionDetails>
                                      </Accordion>
                                    );
                                  })
                                ) : (
                                  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
                                    <CircularProgress size={24} />
                                  </div>
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
  mediaTypes: PropTypes.array,
  stage: PropTypes.string,
  dcsURL: PropTypes.string,
};

export default DcsCatalogAccordion;
