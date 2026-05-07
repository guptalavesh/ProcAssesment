import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import ErrorBoundary from '@/components/layout/ErrorBoundary'

import LandingPage       from '@/pages/LandingPage'
import SetupPage         from '@/pages/SetupPage'
import UploadPage        from '@/pages/UploadPage'
import ColumnReviewPage  from '@/pages/ColumnReviewPage'
import ConfigurePage     from '@/pages/ConfigurePage'
import RunningPage       from '@/pages/RunningPage'
import FormulaReviewPage from '@/pages/FormulaReviewPage'
import ResultsPage       from '@/pages/ResultsPage'
import NotFoundPage      from '@/pages/NotFoundPage'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Landing — full width, no sidebar */}
          <Route path="/" element={<LandingPage />} />

          {/* Assessment wizard — wrapped in AppShell with sidebar */}
          <Route element={<AppShell />}>
            <Route path="/setup"          element={<SetupPage />} />
            <Route path="/upload"         element={<UploadPage />} />
            <Route path="/columns"        element={<ColumnReviewPage />} />
            <Route path="/configure"      element={<ConfigurePage />} />
            <Route path="/running"        element={<RunningPage />} />
            <Route path="/formula-review" element={<FormulaReviewPage />} />
            <Route path="/results"        element={<ResultsPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
