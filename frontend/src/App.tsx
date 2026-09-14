import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import CodexPage from './pages/CodexPage'
import CraftPage from './pages/CraftPage'
import EntityDetailPage from './pages/EntityDetailPage'
import EntityEditPage from './pages/EntityEditPage'
import ItemsPage from './pages/ItemsPage'
import PartyPage from './pages/PartyPage'
import SearchPage from './pages/SearchPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/party" replace />} />
        <Route path="/party" element={<PartyPage />} />
        <Route path="/codex" element={<CodexPage />} />
        <Route path="/items" element={<ItemsPage />} />
        <Route path="/craft" element={<CraftPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/e/:id" element={<EntityDetailPage />} />
        <Route path="/e/:id/edit" element={<EntityEditPage />} />
        <Route path="/new" element={<EntityEditPage />} />
        <Route
          path="*"
          element={
            <div className="empty">
              <div className="meta">Nothing here</div>
            </div>
          }
        />
      </Routes>
    </Layout>
  )
}
