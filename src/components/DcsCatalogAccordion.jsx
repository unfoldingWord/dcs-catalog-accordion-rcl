// React imports
import { useEffect, useState, useMemo, useCallback } from 'react';

// Prop Types for type checking in React
import PropTypes from 'prop-types';

// Axios for making HTTP requests
import axios from 'axios';

// Material UI components
import { Accordion, AccordionSummary, AccordionDetails, Tooltip, Typography } from '@mui/material';
import CircularProgress from '@mui/joy/CircularProgress';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// DOMPurify for sanitizing HTML
import DOMPurify from 'dompurify';

let downloads = [];
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
      else return name.getHostName();
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
  downloads[fmt.asset.browser_download_url] = fmt;
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
      downloads[chapter.asset.browser_download_url] = chapter;
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
        my_fmt.prefx = prefix;
        my_fmt.ext = ext;
        my_fmt.version = version;
        my_fmt.chapters = [];
        downloadable_types[type].push(my_fmt);
      }
      my_fmt.name = asset.name;
      my_fmt.asset = asset;
      downloads[my_fmt.asset.browser_download_url] = my_fmt;
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
    downloads[fmt.asset.browser_download_url] = fmt;
  }
  return downloadable_types;
}

async function getDownloadableTypes(entries) {
  let downloadable_types = new DownloadableTypes();

  if (entries.length < 1) return downloadable_types;

  const top_entry = entries[0];

  // downloadable_types = addAssetToDownloadableTypes(
  //   downloadable_types,
  //   {
  //     name: 'View on Door43.org',
  //     browser_download_url: 'https://preview.door43.org/u/' + top_entry.full_name + '/' + top_entry.branch_or_tag_name,
  //   },
  //   top_entry
  // );
  // downloadable_types = addAssetToDownloadableTypes(
  //   downloadable_types,
  //   {
  //     name: top_entry.name + '-' + top_entry.branch_or_tag_name + '.zip',
  //     browser_download_url: top_entry.zipball_url,
  //   },
  //   top_entry
  // );

  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i];
    for (let j = 0; j < entry.release?.assets.length || 0; j++) {
      let asset = entry.release.assets[j];
      if (
        asset.name.toLowerCase().endsWith('links.json') ||
        asset.name.toLowerCase().endsWith('link.json') ||
        asset.name.toLowerCase().endsWith('assets.json') ||
        asset.name.toLowerCase().endsWith('attachments.json') ||
        asset.name.toLowerCase().endsWith('files.json')
      ) {
        try {
          const response = await axios.get(asset.browser_download_url);
          let linkAssets = response.data;
          if (!Array.isArray(linkAssets)) {
            linkAssets = [linkAssets];
          }
          linkAssets.forEach((linkAsset) => {
            if (linkAsset.browser_download_url) {
              if (!linkAsset.name) {
                linkAsset.name = linkAsset.browser_download_url.substr(linkAsset.browser_download_url.lastIndexOf('/') + 1);
              }
              downloadable_types = addAssetToDownloadableTypes(downloadable_types, linkAsset, entry);
            }
          });
        } catch (error) {
          console.error('Failed to fetch link assets', error);
        }
      } else if (!asset.name.toLowerCase().endsWith('.pdf')) {
        downloadable_types = addAssetToDownloadableTypes(downloadable_types, asset, entry);
      }
    }
  }
  return downloadable_types;
}

function getDescription(fmt, dcs_domain = DEFAULT_DCS_URL) {
  let title = fmt.asset.name;

  if (!fmt.format) {
    fmt.format = getFormatFromName(fmt.asset.name);
  }

  let fmt_description = '';
  let fmt_class = '';

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
  let is_source_regex = new RegExp(`${dcs_domain}/[^/]+/[^/]+/archive/`, 'gi');
  switch (mime_parts[mime_parts.length - 1]) {
    case 'pdf':
      fmt_description = 'PDF';
      fmt_class = 'fa-file-pdf';
      break;
    case 'youtube':
      title = fmt.name;
      show_size = false;
      fmt_class = 'fa-brands fa-youtube';
      fmt_description = 'Website';
      break;
    case 'bloom':
      title = fmt.name;
      show_size = false;
      fmt_description = 'Website';
      fmt_class = 'fa-book';
      break;
    case 'door43.org':
      title = fmt.name;
      fmt_description = 'Website';
      fmt_class = 'fa-globe';
      show_size = false;
      break;
    case new URL(dcs_domain).hostname:
      title = fmt.name;
      fmt_description = 'Source Files';
      fmt_class = 'fa-file-lines';
      show_size = false;
      break;
    case 'docx':
      fmt_description = 'Word Document';
      fmt_class = 'fa-file-word';
      break;
    case 'odt':
      fmt_description = 'OpenDocument Text';
      fmt_class = 'fa-file-text';
      break;
    case 'epub':
      fmt_description = 'ePub Book';
      fmt_class = 'fa-book';
      break;
    case 'markdown':
    case 'md':
      fmt_description = 'Markdown';
      fmt_class = 'fa-file-text';
      break;
    case 'html':
      fmt_description = 'HTML';
      fmt_class = 'fa-code';
      break;
    case 'usfm':
      fmt_description = 'USFM';
      fmt_class = 'fa-file-text';
      break;
    case 'mp3':
      fmt_description = 'MP3';
      fmt_class = 'fa-file-audio';
      break;
    case 'mp4':
      fmt_description = 'MP4';
      fmt_class = 'fa-file-video';
      break;
    case '3gp':
    case '3gpp':
      fmt_description = '3GP';
      fmt_class = 'fa-file-video';
      break;
    case 'zip':
      {
        fmt_class = 'fa-file-zipper';
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
      fmt_class = 'fa-file';
      break;
  }

  if (fmt.quality && fmt.quality != fmt_description) {
    fmt_description += '&nbsp;&ndash;&nbsp;' + fmt.quality;
  }

  let size_string = '';
  if (show_size && fmt.asset.size > 0) {
    size_string = getSize(fmt.asset.size);
    if (is_zipped) {
      size_string += ' zipped';
    }
  }

  if (size_string) {
    size_string = ', ' + size_string;
  }

  if ('identifier' in fmt) {
    title = `<span style="color: #606060">Chapter&nbsp;${parseInt(fmt.identifier).toLocaleString()}:</span> ${title}`;
  }

  return `<i class="fa ${fmt_class}" aria-hidden="true"></i>&ensp;${title}&nbsp;<span style="color: #606060">(${fmt_description}${size_string})</span>`;
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

const DEFAULT_DCS_URL = 'https://git.door43.org';
const API_PATH = 'api/v1';
const DEFAULT_STAGE = 'prod';

const DcsCatalogAccordion = ({ subjects, owners, languages, stage, subjectsExpandedByDefault, dcsURL = DEFAULT_DCS_URL }) => {
  const [languagesData, setLanguagesData] = useState({});
  const [ownersData, setOwnersData] = useState({});
  const [topCatalogEntriesData, setTopCatalogEntriesData] = useState({});
  const [accordionMap, setAccordionMap] = useState();
  const [accordionIdToShow, setAccordionIdToShow] = useState(window.location.hash?.substring(1));

  const handleLanguageAccordionChange = useCallback(
    (lc, expanded) => {
      const fetchOwners = async () => {
        if (expanded && !accordionMap?.[lc]) {
          try {
            const response = await axios.get(
              `${dcsURL}/${API_PATH}/catalog/list/owners?${buildQueryString({ subject: subjects, lang: [lc], owner: owners, stage: [stage || DEFAULT_STAGE] })}`
            );
            const newOwnersData = {};
            const accordionMapOwnerMap = {};
            response.data.data.forEach((info) => {
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
        }
      };

      if (expanded) {
        if (!accordionIdToShow) {
          window.history.pushState(null, null, `#${lc}`);
        }
        fetchOwners();
      }
    },
    [accordionMap, accordionIdToShow, dcsURL, subjects, owners, stage]
  );

  const handleOwnerAccordionChange = useCallback(
    (lc, username, expanded) => {
      const fetchTopCatalogEntries = async () => {
        if (expanded && !accordionMap?.[lc]?.[username]) {
          try {
            const response = await axios.get(`${dcsURL}/${API_PATH}/catalog/search?${buildQueryString({ subject: subjects, lang: [lc], owner: [username], stage: stage })}`);
            const accordionMapOwnerTopCatalogEntriesMap = {};
            const newTopCatalogEntriesMap = {};
            response.data.data.forEach((info) => {
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
        }
      };

      if (expanded) {
        if (!accordionIdToShow) {
          window.history.pushState(null, null, `#${lc}--${username}`);
        }
        fetchTopCatalogEntries();
      }
    },
    [accordionMap, accordionIdToShow, dcsURL, subjects, stage]
  );

  const handleTopCatalogEntriesAccordionChange = useCallback(
    (topCatalogEntry, expanded) => {
      const fetchCatalogEntriesWithDownloadables = async () => {
        if (expanded && !accordionMap?.[topCatalogEntry.language]?.[topCatalogEntry.owner]?.[topCatalogEntry.full_name]) {
          try {
            const response = await axios.get(
              `${dcsURL}/${API_PATH}/catalog/search?owner=${encodeURIComponent(topCatalogEntry.owner)}&repo=${encodeURIComponent(
                topCatalogEntry.name
              )}&includeHistory=1&sort=released&order=desc&stage=${stage || 'prod'}`
            );
            const otherVersionsWithAssets = [];
            for (let i = 0; i < response.data.data.length; i++) {
              if (response.data.data[i].release?.assets?.filter((asset) => !asset.name.toLowerCase().endsWith('.pdf')).length > 0) {
                response.data.data[i].downloadableTypes = await getDownloadableTypes([response.data.data[i]]);
                otherVersionsWithAssets.push(response.data.data[i]);
              }
            }
            setAccordionMap((prevState) => ({
              ...prevState,
              [topCatalogEntry.language]: {
                ...prevState[topCatalogEntry.language],
                [topCatalogEntry.owner]: {
                  ...prevState[topCatalogEntry.language][topCatalogEntry.owner],
                  [topCatalogEntry.name]: otherVersionsWithAssets,
                },
              },
            }));
          } catch (error) {
            console.error('Failed to fetch entries', error);
          }
        }
      };

      if (expanded) {
        if (!accordionIdToShow) {
          window.history.pushState(null, null, `#${topCatalogEntry.language}--${topCatalogEntry.owner}--${topCatalogEntry.name}`);
        }
        fetchCatalogEntriesWithDownloadables();
      }
    },
    [accordionMap, accordionIdToShow, dcsURL, stage]
  );

  const handleDownloadableEntryChange = (entry, expanded) => {
    if (expanded) {
      window.history.pushState(null, null, `#${entry.language}--${entry.owner}--${entry.name}--${entry.branch_or_tag_name}`);
    }
  };

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await axios.get(`${dcsURL}/${API_PATH}/catalog/list/languages?${buildQueryString({ owner: owners, subject: subjects, stage: [stage || DEFAULT_STAGE] })}`);
        const langData = {};
        const accMap = {};
        response.data.data.forEach((info) => {
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

    const collapseAllAccordions = () => {
      const accordions = document.querySelectorAll('.MuiAccordion-root');
      accordions.forEach((accordion) => {
        if (accordion.classList.contains('Mui-expanded')) {
          accordion.firstElementChild.click();
        }
      });
    };

    collapseAllAccordions();
    fetchLanguages();
  }, [dcsURL, languages, subjects, owners, stage]);

  useEffect(() => {
    const handleAccordionIdToShow = async () => {
      const [lang, username, reponame, version] = accordionIdToShow.split('--');

      let langAccordion = lang && document.getElementById(lang);
      let ownerAccordion = username && document.getElementById(`${lang}--${username}`);
      let repoAccordion = reponame && document.getElementById(`${lang}--${username}--${reponame}`);
      let versionAccordion = version && document.getElementById(`${lang}--${username}--${reponame}--${version}`);

      const finish = () => {
        if (versionAccordion) {
          versionAccordion.scrollIntoView();
        } else if (repoAccordion) {
          repoAccordion.scrollIntoView();
        } else if (ownerAccordion) {
          ownerAccordion.scrollIntoView();
        } else if (langAccordion) {
          langAccordion.scrollIntoView();
        }
        setAccordionIdToShow('');
      };

      if (lang in accordionMap && !accordionMap[lang]) {
        langAccordion?.firstElementChild?.click();
        if (!username || !langAccordion) {
          finish();
        }
      } else if (username in (accordionMap?.[lang] || []) && !accordionMap[lang][username]) {
        ownerAccordion?.firstElementChild?.click();
        if (!ownerAccordion || !reponame) {
          finish();
        }
      } else if (reponame in (accordionMap?.[lang]?.[username] || []) && !accordionMap[lang][username][reponame]) {
        const repoAccordion = document.getElementById(`${lang}--${username}--${reponame}`);
        if (repoAccordion) {
            repoAccordion.firstElementChild?.click();
        }
        if (version) {
          const timeout = 5000; // 5 seconds
          const interval = 500; // 500 ms
          let elapsedTime = 0;
          const checkVersionAccordion = setInterval(() => {
            const versionAccordion = document.getElementById(`${lang}--${username}--${reponame}--${version}`);
            if (versionAccordion) {
              versionAccordion.firstElementChild?.click();
              clearInterval(checkVersionAccordion);
            } else {
              elapsedTime += interval;
              if (elapsedTime >= timeout) {
                clearInterval(checkVersionAccordion);
                console.log('Version accordion not found');
              }
            }
          }, interval);
        }
        finish();
      } else {
        finish();
      }
    };

    if (accordionIdToShow && accordionMap) {
      handleAccordionIdToShow();
    }
  }, [accordionIdToShow, accordionMap, topCatalogEntriesData]);

  return (
    <div>
      {Object.keys(accordionMap || {}).length ? (
        Object.keys(accordionMap)?.map((lc) => (
          <Accordion id={lc} key={lc} onChange={(event, expanded) => handleLanguageAccordionChange(lc, expanded)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
                  <Accordion id={`${lc}--${username}`} key={username} onChange={(event, expanded) => handleOwnerAccordionChange(lc, username, expanded)}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Tooltip title={username} arrow>
                        <Typography style={{ fontWeight: 'bold' }}>
                          Published by: {ownersData[username] && ownersData[username].full_name ? `${ownersData[username].full_name} (${username})` : username}
                        </Typography>
                      </Tooltip>
                    </AccordionSummary>
                    <AccordionDetails>
                      {Object.keys(accordionMap[lc][username] || {}).length ? (
                        Object.keys(accordionMap[lc][username] || {})?.map((reponame) => {
                          const id = `${username}/${reponame}`;
                          const topEntry = topCatalogEntriesData[id];
                          return (
                            <Accordion id={`${lc}--${username}--${reponame}`} key={id} onChange={(event, expanded) => handleTopCatalogEntriesAccordionChange(topEntry, expanded)} defaultExpanded={!accordionIdToShow && subjectsExpandedByDefault?.includes(topEntry.subject)}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Tooltip title={topEntry.subject} arrow>
                                  <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                                    <Typography style={{ fontWeight: 'bold', flex: 1 }}>{topEntry.title}</Typography>
                                    <Typography style={{ fontWeight: 'normal', marginRight: '1rem' }}>{topEntry.branch_or_tag_name}</Typography>{' '}
                                  </div>
                                </Tooltip>
                              </AccordionSummary>
                              <AccordionDetails>
                                <ul key="links" style={{ paddingTop: 0, marginTop: 0 }}>
                                  <li key="pdf">
                                    <a
                                      href={`https://preview.door43.org/u/${topCatalogEntriesData[id].full_name}/${topCatalogEntriesData[id].branch_or_tag_name}`}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
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
                                      Source Files (Zipped)
                                    </a>
                                  </li>
                                </ul>
                                {accordionMap[lc][username][reponame]?.length ? (
                                  <div style={{ paddingLeft: '10px' }} key="downloadables">
                                    <h4>Downloadables:</h4>
                                    {accordionMap[lc][username][reponame]?.map((entry) => (
                                      <Accordion
                                        id={`${lc}--${username}--${reponame}--${entry.branch_or_tag_name}`}
                                        key={entry.branch_or_tag_name}
                                        onChange={(event, expanded) => handleDownloadableEntryChange(entry, expanded)}
                                      >
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                          <Tooltip title={entry.release?.name} arrow>
                                            <Typography>{entry.branch_or_tag_name}</Typography>
                                          </Tooltip>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                          {allowedDownloadableTypes.map((type) => {
                                            if (!(type in entry.downloadableTypes) || !entry.downloadableTypes[type].length) {
                                              return null;
                                            }
                                            return (
                                              <div key={type} style={{ paddingLeft: '10px' }}>
                                                <div>{type.charAt(0).toUpperCase() + type.slice(1)}</div>
                                                <ul>
                                                  {entry.downloadableTypes[type].map((format) => {
                                                    const description = getDescription(format, dcsURL);
                                                    const cleanHTML = DOMPurify.sanitize(description, {
                                                      ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong'],
                                                      ALLOWED_ATTR: ['href', 'title', 'style', 'target'],
                                                    });
                                                    return (
                                                      <li key={format.name}>
                                                        <a
                                                          href={format.asset.browser_download_url}
                                                          style={{ textDecoration: 'none' }}
                                                          target="_blank"
                                                          dangerouslySetInnerHTML={{ __html: cleanHTML }}
                                                          rel="noreferrer noopener"
                                                        ></a>
                                                      </li>
                                                    );
                                                  })}
                                                </ul>
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
  subjectsExpandedByDefault: PropTypes.array,
  stage: PropTypes.string,
  dcsURL: PropTypes.string,
};

export default DcsCatalogAccordion;
