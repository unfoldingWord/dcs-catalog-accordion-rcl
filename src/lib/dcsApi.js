// Shared DCS catalog API constants and helpers used by all components.

export const DEFAULT_DCS_URL = 'https://git.door43.org';
export const API_PATH = 'api/v1';
export const DEFAULT_STAGE = 'prod';

// The "Media" filter choices, the catalog query param each one maps to, and the
// stats-ext response field holding its count. The has* params are honored by
// catalog/stats-ext, catalog/search and the catalog/list/* endpoints alike.
export const MEDIA_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF', param: 'hasPDF', statKey: 'has_pdf' },
  { value: 'audio', label: 'Audio', param: 'hasAudio', statKey: 'has_audio' },
  { value: 'video', label: 'Video', param: 'hasVideo', statKey: 'has_video' },
  { value: 'stream', label: 'Stream/Embed', param: 'hasStream', statKey: 'has_stream' },
  { value: 'other', label: 'Other', param: 'hasOther', statKey: 'has_other' },
];

export const buildQueryString = (keyedArrays) => {
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

// Converts a mediaTypes array (['pdf', 'video', ...]) into the has* query params.
export const mediaTypeParams = (mediaTypes) => {
  const params = {};
  (mediaTypes || []).forEach((value) => {
    const option = MEDIA_TYPE_OPTIONS.find((o) => o.value === value);
    if (option) {
      params[option.param] = 'true';
    }
  });
  return params;
};
