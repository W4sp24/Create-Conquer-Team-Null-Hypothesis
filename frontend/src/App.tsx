import { Routes, Route } from 'react-router-dom'
import InputPage from './pages/InputPage'
import ReviewContextPage from './pages/ReviewContextPage'
import AgentStatusPage from './pages/AgentStatusPage'
import OutputPage from './pages/OutputPage'
import SourcesPage from './pages/SourcesPage'
import CompareView from './components/CompareView'
import RoadmapPage from './pages/RoadmapPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<InputPage />} />
      <Route path="/review" element={<ReviewContextPage />} />
      <Route path="/status" element={<AgentStatusPage />} />
      <Route path="/output" element={<OutputPage />} />
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="/compare" element={<CompareView />} />
      <Route path="/roadmap" element={<RoadmapPage />} />
    </Routes>
  )
}
