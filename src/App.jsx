import DcsResourceAccordion from './components/DcsCatalogAccordion'
import './App.css'

function App() {
  return (
    <>
      <DcsResourceAccordion subjects={['Open Bible Stories']} languages={['fr']} owners={["MVHS"]} />
    </>
  )
}

export default App
