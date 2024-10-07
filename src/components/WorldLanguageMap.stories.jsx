// WorldLanguageMap.stories.jsx

import { useState } from 'react';
import WorldLanguageMap from './WorldLanguageMap';

export default {
  title: 'Components/WorldLanguageMap',
  component: WorldLanguageMap,
};

const Template = (args) => {
  const [languages, setLanguages] = useState([]);

  const handleContinentClick = async (languages) => {
    setLanguages(languages);
  };

  return (
    <div style={{ textAlign: "center" }}>
      <WorldLanguageMap {...args} onContinentClick={handleContinentClick} />
      {languages.length > 0 && (
        <select multiple style={{ resize: "both", width: "300px" }}>
          {languages.map((language, index) => (
            <option key={index} value={language.code}>
              {language.ln} ({language.lc})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export const Default = Template.bind({});
Default.args = {
  filterByCatalog: true,
  stage: "other",
  style: {maxWidth: "1024px"}
};

export const OBSWithProdStage = Template.bind({});
OBSWithProdStage.args = {
  filterByCatalog: true,
  subjects: ["Open Bible Stories", "OBS Translation Notes", "OBS Translation Questions"],
  stage: "prod",
  style: {maxWidth: "1024px"},
};

export const OBSWithOtherStage = Template.bind({});
OBSWithOtherStage.args = {
  filterByCatalog: true,
  subjects: ["Open Bible Stories", "OBS Translation Notes", "OBS Translation Questions"],
  stage: "other",
  style: {maxWidth: "1024px"},
};