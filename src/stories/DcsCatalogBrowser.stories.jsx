import DcsCatalogBrowser from '../components/DcsCatalogBrowser';

export default {
  title: 'Components/DcsCatalogBrowser',
  component: DcsCatalogBrowser,
  parameters: {
    layout: 'padded',
  },
};

const OBS_SUBJECTS = ['Open Bible Stories', 'TSV OBS Translation Notes', 'TSV OBS Translation Questions', 'TSV OBS Study Notes', 'TSV OBS Study Questions'];

export const MapFilterAndAccordion = {
  args: {
    subjects: OBS_SUBJECTS,
  },
};

export const FilterAndAccordion = {
  args: {
    subjects: OBS_SUBJECTS,
    showMap: false,
  },
};

export const MapAndAccordion = {
  args: {
    subjects: OBS_SUBJECTS,
    showFilter: false,
  },
};

export const WholeCatalog = {
  args: {},
};
