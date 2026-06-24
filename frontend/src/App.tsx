import { Routes, Route } from 'react-router-dom'
import InputPage from './pages/InputPage'
import AgentStatusPage from './pages/AgentStatusPage'
import OutputPage from './pages/OutputPage'
import SourcesPage from './pages/SourcesPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InputPage />} />
      <Route path="/status" element={<AgentStatusPage />} />
      <Route path="/output" element={<OutputPage />} />
      <Route path="/sources" element={<SourcesPage />} />
    </Routes>
  )
}
