import DcsCatalogAccordion from '../components/DcsCatalogAccordion';

export default {
  title: 'Components/DcsCatalogAccordion',
  component: DcsCatalogAccordion,
  parameters: {
    layout: 'padded',
  },
};

export const AllLanguages = {
  args: {
    subjects: [],
    languages: [],
  },
};

export const EnglishOnly = {
  args: {
    subjects: [],
    languages: ['en'],
  },
};

export const OpenBibleStories = {
  args: {
    subjects: ['Open Bible Stories', 'TSV OBS Translation Notes', 'TSV OBS Translation Questions', 'TSV OBS Study Notes', 'TSV OBS Study Questions'],
    languages: [],
  },
};

export const UnfoldingWordOwner = {
  args: {
    subjects: [],
    languages: [],
    owners: ['unfoldingWord'],
  },
};
