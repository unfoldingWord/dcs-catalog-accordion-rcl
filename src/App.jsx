import WorldLanguageMap from './components/WorldLanguageMap';
import './App.css';
import { useState } from 'react';

const urlParams = new URLSearchParams(window.location.search);
const subjects = urlParams.getAll('subject') || [];
const stage = urlParams.get('stage') || 'other';

function App() {
  const [languages, setLanguages] = useState([]);

  return (
    <>
      <div style={{ width: '1024px' }}>
        <WorldLanguageMap subjects={subjects} stage={stage} onContinentClick={setLanguages} />
      </div>

      <div>
        <select multiple style={{ resize: "both" }}>
          {languages.map((lang, index) => (
            <option key={index} value={lang.lc}>
              {lang.ln} ({lang.lc})
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default App;
