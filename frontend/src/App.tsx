import { HashRouter, Route, Routes } from 'react-router-dom'
import LandingPage from './landing/LandingPage'
import AppShell from './layout/AppShell'
import CommandCentrePage from './pages/CommandCentrePage'
import CompanyInvestigationPage from './pages/CompanyInvestigationPage'
import DependencyExplorerPage from './pages/DependencyExplorerPage'
import DigitalTwinPage from './pages/DigitalTwinPage'
import EvidenceReportsPage from './pages/EvidenceReportsPage'
import GovernancePage from './pages/GovernancePage'
import InsurancePage from './pages/InsurancePage'
import MitigationStudioPage from './pages/MitigationStudioPage'
import PortfolioDashboardPage from './pages/PortfolioDashboardPage'
import PortfolioImpactPage from './pages/PortfolioImpactPage'
import RealMarketSensitivityPage from './pages/RealMarketSensitivityPage'
import ScenarioLabPage from './pages/ScenarioLabPage'
import WhatIfAnalysisPage from './pages/WhatIfAnalysisPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Landing page — public entry point */}
        <Route index element={<LandingPage />} />

        {/* App shell wraps all dashboard/tool pages */}
        <Route element={<AppShell />}>
          <Route path="app" element={<CommandCentrePage />} />
          <Route path="dashboard" element={<PortfolioDashboardPage />} />
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
          <Route path="governance" element={<GovernancePage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
