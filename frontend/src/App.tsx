import { HashRouter, Route, Routes } from 'react-router-dom'
import AppShell from './layout/AppShell'
import CommandCentrePage from './pages/CommandCentrePage'
import CompanyInvestigationPage from './pages/CompanyInvestigationPage'
import DependencyExplorerPage from './pages/DependencyExplorerPage'
import DigitalTwinPage from './pages/DigitalTwinPage'
import EvidenceReportsPage from './pages/EvidenceReportsPage'
import InsurancePage from './pages/InsurancePage'
import MitigationStudioPage from './pages/MitigationStudioPage'
import PortfolioImpactPage from './pages/PortfolioImpactPage'
import RealMarketSensitivityPage from './pages/RealMarketSensitivityPage'
import ScenarioLabPage from './pages/ScenarioLabPage'
import WhatIfAnalysisPage from './pages/WhatIfAnalysisPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<CommandCentrePage />} />
          <Route path="twin" element={<DigitalTwinPage />} />
          <Route path="scenario" element={<ScenarioLabPage />} />
          <Route path="what-if" element={<WhatIfAnalysisPage />} />
          <Route path="dependency" element={<DependencyExplorerPage />} />
          <Route path="company" element={<CompanyInvestigationPage />} />
          <Route path="portfolio" element={<PortfolioImpactPage />} />
          <Route path="mitigation" element={<MitigationStudioPage />} />
          <Route path="insurance" element={<InsurancePage />} />
          <Route path="real-market" element={<RealMarketSensitivityPage />} />
          <Route path="evidence" element={<EvidenceReportsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
