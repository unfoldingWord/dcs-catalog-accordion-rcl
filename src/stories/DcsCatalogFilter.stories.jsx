import { useState } from 'react';
import DcsCatalogFilter from '../components/DcsCatalogFilter';

export default {
  title: 'Components/DcsCatalogFilter',
  component: DcsCatalogFilter,
  parameters: {
    layout: 'padded',
  },
  args: {
    onFilterChange: (filter) => console.log('Filter changed:', filter),
    onStatsChange: (stats) => console.log('Stats changed:', stats),
  },
};

export const WholeCatalog = {
  args: {
    subjects: [],
    languages: [],
    owners: [],
  },
};

export const OpenBibleStories = {
  args: {
    subjects: ['Open Bible Stories', 'TSV OBS Translation Notes', 'TSV OBS Translation Questions', 'TSV OBS Study Notes', 'TSV OBS Study Questions'],
    languages: [],
    owners: [],
  },
};

const FilterWithPayloads = (args) => {
  const [filter, setFilter] = useState(null);
  return (
    <div>
      <DcsCatalogFilter {...args} onFilterChange={setFilter} />
      <pre style={{ background: '#f6f8fa', padding: '8px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
        {filter ? JSON.stringify(filter, null, 2) : '(nothing selected yet)'}
      </pre>
    </div>
  );
};

export const WithFilterPayload = {
  args: OpenBibleStories.args,
  render: (args) => <FilterWithPayloads {...args} />,
};
