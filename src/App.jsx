import DcsCatalogAccordion from './components/DcsCatalogAccordion';
import WorldLanguageMap from './components/WorldLanguageMap';
import './App.css';
import { useState } from 'react';

const subjects = [];

function App() {
  const [languages, setLanguages] = useState([]);

  const accordionProps = {
    languages,
    subjects,
  };

  return (
    <div style={{width: "600px"}}>
      <WorldLanguageMap onContinentClick={setLanguages} />
      <DcsCatalogAccordion {...accordionProps} />
    </div>
  )
}

export default App
