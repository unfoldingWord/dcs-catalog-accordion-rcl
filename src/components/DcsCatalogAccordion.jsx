// React imports
import { useEffect, useState } from 'react';

// Prop Types for type checking in React
import PropTypes from 'prop-types';

// Axios for making HTTP requests
import axios from 'axios';

// Material UI components
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Typography,
} from '@mui/material';
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
  Object.keys(keyedArrays).forEach(key => {
    const values = keyedArrays[key];
    if (Array.isArray(values)) {
      values.forEach(value => {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(values)}`);
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
  downloadable_types = addAssetToDownloadableTypes(
    downloadable_types,
    {
      name: top_entry.name + '-' + top_entry.branch_or_tag_name + '.zip',
      browser_download_url: top_entry.zipball_url,
    },
    top_entry
  );

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
      } else {
        downloadable_types = addAssetToDownloadableTypes(downloadable_types, asset, entry);
      }
    }
  }
  return downloadable_types;
}

function getDescription(fmt, dcs_domain = 'git.door43.org') {
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

export const DcsCatalogAccordion = ({subjects = [], owners = [], languages = [], stage = "prod", dcsApiURL = "https://git.door43.org/api/v1"}) => {
  const [fetchingLanguages, setFetchingLanguages] = useState(false);
  const [languagesData, setLanguagesData] = useState({});
  const [ownersData, setOwnersData] = useState({});
  const [topCatalogEntriesData, setTopCatalogEntriesData] = useState({});
  const [accordionMap, setAccordionMap] = useState();

  const handleLanguageAccordionChange = async (lc, expanded) => {
    if (expanded && ! accordionMap?.[lc]) {
      try {
        const response = await axios.get(`${dcsApiURL}/catalog/list/owners?${buildQueryString({subject: subjects, lang: [lc], owner: owners, stage: [stage]})}`);    
        const newOwnersData = {};
        const accordionMapOwnerMap = {}
        response.data.data.forEach(info => {
          newOwnersData[info.username] = info;
          accordionMapOwnerMap[info.username] = null;
        })
        setOwnersData(prevState => ({
          ...prevState,
          ...newOwnersData,
        }));
        setAccordionMap(prevState => ({
          ...prevState,
          [lc]: accordionMapOwnerMap,
        }))
      } catch (error) {
        console.error('Failed to fetch owners', error);
      }
    }
  };

  const handleOwnerAccordionChange = async (lc, username, expanded) => {
    if (expanded && !accordionMap?.[lc]?.[username]) {
      try {
        const response = await axios.get(
          `${dcsApiURL}/catalog/search?${buildQueryString({subject: subjects, lang: [lc], owner: [username], stage: [stage]})}`
        );
        const accordionMapOwnerTopCatalogEntriesMap = {};
        const newTopCatalogEntriesMap = {};
        response.data.data.forEach(info => {
          newTopCatalogEntriesMap[info.id] = info;
          accordionMapOwnerTopCatalogEntriesMap[info.id] = null;
        });
        setTopCatalogEntriesData(prevState => ({
          ...prevState,
          ...newTopCatalogEntriesMap,
        }))
        setAccordionMap(prevState => ({
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

  const handleTopCatalogEntriesAccordionChange = async (topCatalogEntry, expanded) => {
    if (expanded && !accordionMap?.[topCatalogEntry.language]?.[topCatalogEntry.owner]?.[topCatalogEntry.id]) {
      try {
        const response = await axios.get(
          `${dcsApiURL}/catalog/search?owner=${encodeURIComponent(topCatalogEntry.owner)}&repo=${encodeURIComponent(topCatalogEntry.name)}&includeHistory=1&sort=released&order=desc&stage=${stage}`
        );
        for (let i = 0; i < response.data.data.length; i++) {
          response.data.data[i].downloadableTypes = await getDownloadableTypes([response.data.data[i]]);
        }
        setAccordionMap(prevState => ({
          ...prevState,
          [topCatalogEntry.language]: {
            ...prevState[topCatalogEntry.language],
            [topCatalogEntry.owner]: {
              ...prevState[topCatalogEntry.language][topCatalogEntry.owner],
              [topCatalogEntry.id]: response.data.data,
            }
          },
        }));
      } catch (error) {
        console.error('Failed to fetch entries', error);
      }
    }
  };

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await axios.get(`${dcsApiURL}/catalog/list/languages?${buildQueryString({lang: languages, owner: owners, subject: subjects, stage: [stage]})}`);
        const langData = {}
        const accMap = {}
        response.data.data.forEach(info => {
          langData[info.lc] = info;
          accMap[info.lc] = null;
        })
        setLanguagesData(langData);
        setAccordionMap(accMap);
      } catch (error) {
        console.log('Error fetching languages', error);
        setAccordionMap({});
      }
      setFetchingLanguages(false);
    };

    if (dcsApiURL && ! fetchingLanguages && ! accordionMap) {
      console.log(dcsApiURL, fetchingLanguages);
      setFetchingLanguages(true);
      fetchLanguages();
    }
  }, [dcsApiURL, subjects, languages, owners, stage, accordionMap, fetchingLanguages]);

  return (
    <>
      <div>
      {Object.keys(accordionMap || {})?.map(lc => (
        <Accordion key={lc} onChange={(event, expanded) => handleLanguageAccordionChange(lc, expanded)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Tooltip title={lc} arrow>
              <Typography>
                {lc} {languagesData?.[lc] && <>/ <span style={{ direction: languagesData[lc].ld || "ltr" }}>{languagesData[lc].ln}</span> / {languagesData[lc].ang}</>}
              </Typography>
            </Tooltip>
          </AccordionSummary>
          <AccordionDetails>
            {Object.keys(accordionMap[lc] || {})?.map(username => (
              <Accordion key={username} onChange={(event, expanded) => handleOwnerAccordionChange(lc, username, expanded)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Tooltip title={username} arrow>
                    <Typography>{ownersData[username] && ownersData[username].full_name ? `${ownersData[username].full_name} (${username})` : username}</Typography>
                  </Tooltip>
                </AccordionSummary>
                <AccordionDetails>
                  {Object.keys(accordionMap[lc][username] || {})?.map(id => (
                    <Accordion key={id} onChange={(event, expanded) => handleTopCatalogEntriesAccordionChange(topCatalogEntriesData[id], expanded)}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Tooltip title={topCatalogEntriesData[id].subject} arrow>
                          <Typography>{topCatalogEntriesData[id].title}</Typography>
                        </Tooltip>
                      </AccordionSummary>
                      <AccordionDetails>
                        {accordionMap[lc][username][id]?.map(entry => (
                          <Accordion key={entry.branch_or_tag_name}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Tooltip title={entry.release?.name} arrow>
                                <Typography>{entry.branch_or_tag_name}</Typography>
                              </Tooltip>
                            </AccordionSummary>
                            <AccordionDetails>
                              <div key="preview" style={{ paddingLeft: '10px' }}>
                                <div>Preview</div>
                                <ul>
                                  <li key="pdf">
                                    <a
                                      href={`https://preview.door43.org/u/${entry.full_name}/${entry.branch_or_tag_name}`}
                                      style={{ textDecoration: 'none' }}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >Preview / PDF</a>
                                  </li>
                                </ul>
                              </div>
                              {allowedDownloadableTypes.map((type) => {
                                console.log(entry.downloadableTypes);
                                if (!(type in entry.downloadableTypes) || !entry.downloadableTypes[type].length) {
                                  return null;
                                }
                                return (
                                  <div key={type} style={{ paddingLeft: '10px' }}>
                                    <div>{type.charAt(0).toUpperCase() + type.slice(1)}</div>
                                    <ul>
                                      {entry.downloadableTypes[type].map((format) => {
                                        const description = getDescription(format, dcsApiURL);
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
                              }) || <CircularProgress />}
                            </AccordionDetails>
                          </Accordion>
                        )) || <CircularProgress />}
                      </AccordionDetails>
                    </Accordion>
                  )) || <CircularProgress />}
                </AccordionDetails>
              </Accordion>
            )) || <CircularProgress />}
          </AccordionDetails>
        </Accordion>
      )) || <CircularProgress />}
      </div>
    </>
  );
};

DcsCatalogAccordion.propTypes = {
  languages: PropTypes.array,
  owners: PropTypes.array,
  subjects: PropTypes.array,
  stage: PropTypes.string,
  dcsApiURL: PropTypes.object,
};

export default DcsCatalogAccordion;