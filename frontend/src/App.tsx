import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/common/Layout'
import ConnectionPage from './pages/ConnectionPage'
import ScanPage from './pages/ScanPage'
import ResourcesPage from './pages/ResourcesPage'
import GeneratePage from './pages/GeneratePage'
import TemplatesPage from './pages/TemplatesPage'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ConnectionPage />} />
          <Route path="/connection" element={<ConnectionPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/resources/:scanId" element={<ResourcesPage />} />
          <Route path="/generate/:scanId" element={<GeneratePage />} />
          <Route path="/templates" element={<TemplatesPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App

