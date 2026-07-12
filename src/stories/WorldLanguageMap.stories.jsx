import { useState } from 'react';
import WorldLanguageMap from '../components/WorldLanguageMap';
import DcsCatalogAccordion from '../components/DcsCatalogAccordion';

export default {
  title: 'Components/WorldLanguageMap',
  component: WorldLanguageMap,
  parameters: {
    layout: 'padded',
  },
};

export const Default = {
  args: {
    onContinentClick: (languages) => console.log('Selected languages:', languages),
  },
};

const MapWithAccordion = () => {
  const [languages, setLanguages] = useState([]);
  return (
    <div style={{ width: '1024px' }}>
      <WorldLanguageMap onContinentClick={setLanguages} />
      <DcsCatalogAccordion subjects={[]} languages={languages} />
    </div>
  );
};

export const WithCatalogAccordion = {
  render: () => <MapWithAccordion />,
};
